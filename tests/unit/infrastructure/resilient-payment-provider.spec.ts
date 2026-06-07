import { test } from '@japa/runner'
import { Payment } from '#payments/domain/entities/payment'
import { Money } from '#payments/domain/value-objects/money'
import { PaymentMethod } from '#payments/domain/value-objects/payment-method'
import { PaymentProvider, ProviderInitiation } from '#payments/domain/ports/payment-provider'
import { PaymentStatusValue } from '#payments/domain/value-objects/payment-status'
import { ProviderUnavailableError } from '#payments/domain/errors/provider-unavailable.error'
import { ResilientPaymentProvider } from '#payments/infrastructure/provider/resilient-payment-provider'

const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'

class FakePaymentProvider extends PaymentProvider {
  public calls = 0
  public responses: Array<{ type: 'success'; value: any } | { type: 'failure'; error: Error }> = []

  async initiate(_payment: Payment): Promise<ProviderInitiation> {
    this.calls++
    const next = this.responses.shift()
    if (!next) {
      throw new ProviderUnavailableError('No mock response configured')
    }
    if (next.type === 'failure') {
      throw next.error
    }
    return next.value
  }

  async fetchStatus(_providerTxId: string): Promise<PaymentStatusValue> {
    this.calls++
    const next = this.responses.shift()
    if (!next) {
      throw new ProviderUnavailableError('No mock response configured')
    }
    if (next.type === 'failure') {
      throw next.error
    }
    return next.value
  }
}

test.group('ResilientPaymentProvider', () => {
  const dummyPayment = Payment.initiate({
    money: Money.create(1000, 'BRL'),
    method: PaymentMethod.fromString('PAYPAL'),
    productId: PRODUCT_ID,
  })

  test('calls the underlying provider directly and returns on success', async ({ assert }) => {
    const fake = new FakePaymentProvider()
    fake.responses.push({
      type: 'success',
      value: { providerTxId: 'tx_123', status: 'pending' },
    })

    const resilient = new ResilientPaymentProvider(fake)
    const result = await resilient.initiate(dummyPayment)

    assert.equal(result.providerTxId, 'tx_123')
    assert.equal(fake.calls, 1)
    assert.equal(resilient.getCircuitState(), 'CLOSED')
  })

  test('retries transient failures and eventually succeeds', async ({ assert }) => {
    const fake = new FakePaymentProvider()
    fake.responses.push({
      type: 'failure',
      error: new ProviderUnavailableError('Transient failure 1'),
    })
    fake.responses.push({
      type: 'failure',
      error: new ProviderUnavailableError('Transient failure 2'),
    })
    fake.responses.push({
      type: 'success',
      value: { providerTxId: 'tx_123', status: 'processed' },
    })

    // Retries 2 times (total 3 attempts), delay 5ms for fast test execution
    const resilient = new ResilientPaymentProvider(
      fake,
      2, // maxRetries
      5, // initialDelayMs
      2 // backoffFactor
    )
    const result = await resilient.initiate(dummyPayment)

    assert.equal(result.providerTxId, 'tx_123')
    assert.equal(fake.calls, 3)
    assert.equal(resilient.getCircuitState(), 'CLOSED')
  })

  test('propagates the error when retries are exhausted', async ({ assert }) => {
    const fake = new FakePaymentProvider()
    fake.responses.push({
      type: 'failure',
      error: new ProviderUnavailableError('Transient failure 1'),
    })
    fake.responses.push({
      type: 'failure',
      error: new ProviderUnavailableError('Transient failure 2'),
    })
    fake.responses.push({
      type: 'failure',
      error: new ProviderUnavailableError('Transient failure 3'),
    })

    const resilient = new ResilientPaymentProvider(
      fake,
      2, // maxRetries (which means 3 total attempts)
      5, // initialDelayMs
      2 // backoffFactor
    )

    await assert.rejects(
      () => resilient.initiate(dummyPayment),
      ProviderUnavailableError,
      'Transient failure 3'
    )
    assert.equal(fake.calls, 3)
  })

  test('trips the circuit breaker to OPEN after consecutive failures', async ({ assert }) => {
    const fake = new FakePaymentProvider()
    for (let i = 0; i < 6; i++) {
      fake.responses.push({
        type: 'failure',
        error: new ProviderUnavailableError('Provider is down'),
      })
    }

    // Retries = 0 to avoid waiting/looping inside retry, failureThreshold = 3
    const resilient = new ResilientPaymentProvider(
      fake,
      0, // maxRetries
      1, // initialDelayMs
      1, // backoffFactor
      3, // failureThreshold
      5000 // cooldownMs
    )

    // Call 1: fails, consecutive = 1, state = CLOSED
    await assert.rejects(() => resilient.initiate(dummyPayment))
    assert.equal(resilient.getCircuitState(), 'CLOSED')

    // Call 2: fails, consecutive = 2, state = CLOSED
    await assert.rejects(() => resilient.initiate(dummyPayment))
    assert.equal(resilient.getCircuitState(), 'CLOSED')

    // Call 3: fails, consecutive = 3, trips to OPEN
    await assert.rejects(() => resilient.initiate(dummyPayment))
    assert.equal(resilient.getCircuitState(), 'OPEN')

    // Call 4: fails fast immediately without calling fake
    await assert.rejects(() => resilient.initiate(dummyPayment), /Circuit breaker is OPEN/)

    assert.equal(fake.calls, 3) // fake should not have been called a 4th time
  })

  test('cooldown transition: OPEN -> HALF_OPEN -> CLOSED on success', async ({ assert }) => {
    const fake = new FakePaymentProvider()
    // First call fails
    fake.responses.push({
      type: 'failure',
      error: new ProviderUnavailableError('Provider is down'),
    })
    // Second call succeeds
    fake.responses.push({
      type: 'success',
      value: { providerTxId: 'tx_success', status: 'processed' },
    })

    const resilient = new ResilientPaymentProvider(
      fake,
      0, // maxRetries
      1, // initialDelayMs
      1, // backoffFactor
      1, // failureThreshold (1 failure trips circuit)
      10 // cooldownMs (10ms cooldown)
    )

    // Call 1: fails, trips circuit immediately because threshold = 1
    await assert.rejects(() => resilient.initiate(dummyPayment))
    assert.equal(resilient.getCircuitState(), 'OPEN')

    // Sleep 15ms (> 10ms cooldown)
    await new Promise((resolve) => setTimeout(resolve, 15))

    // Call 2: should transition to HALF_OPEN and succeed, resetting to CLOSED
    const result = await resilient.initiate(dummyPayment)
    assert.equal(result.providerTxId, 'tx_success')
    assert.equal(resilient.getCircuitState(), 'CLOSED')
    assert.equal(fake.calls, 2)
  })

  test('cooldown transition: OPEN -> HALF_OPEN -> OPEN on failure', async ({ assert }) => {
    const fake = new FakePaymentProvider()
    // First call fails
    fake.responses.push({
      type: 'failure',
      error: new ProviderUnavailableError('Provider is down'),
    })
    // Second call fails too
    fake.responses.push({
      type: 'failure',
      error: new ProviderUnavailableError('Provider is still down'),
    })

    const resilient = new ResilientPaymentProvider(
      fake,
      0, // maxRetries
      1, // initialDelayMs
      1, // backoffFactor
      1, // failureThreshold
      10 // cooldownMs
    )

    // Call 1: fails, trips circuit to OPEN
    await assert.rejects(() => resilient.initiate(dummyPayment))
    assert.equal(resilient.getCircuitState(), 'OPEN')

    // Sleep 15ms (> 10ms cooldown)
    await new Promise((resolve) => setTimeout(resolve, 15))

    // Call 2: transitions to HALF_OPEN, fails, trips back to OPEN immediately
    await assert.rejects(() => resilient.initiate(dummyPayment), /Provider is still down/)
    assert.equal(resilient.getCircuitState(), 'OPEN')
    assert.equal(fake.calls, 2)
  })
})
