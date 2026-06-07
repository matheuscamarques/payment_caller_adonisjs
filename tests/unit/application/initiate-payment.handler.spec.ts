import { test } from '@japa/runner'
import { InitiatePaymentHandler } from '#payments/application/commands/initiate-payment/initiate-payment.handler'
import { InitiatePaymentCommand } from '#payments/application/commands/initiate-payment/initiate-payment.command'
import { ProviderUnavailableError } from '#payments/domain/errors/provider-unavailable.error'
import { InvalidPaymentMethodError } from '#payments/domain/errors/invalid-payment-data.error'
import { InMemoryPaymentRepository, FakePaymentProvider } from '#tests/helpers/payment_doubles'

const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'
const validCommand = () => new InitiatePaymentCommand(3452, 'BRL', 'PAYPAL', PRODUCT_ID)

test.group('InitiatePaymentHandler', () => {
  test('persists as pending, calls the provider and links the tx id', async ({ assert }) => {
    const repo = new InMemoryPaymentRepository()
    const provider = new FakePaymentProvider({
      initiation: { providerTxId: 'tx_777', status: 'processed' },
    })
    const handler = new InitiatePaymentHandler(repo, provider)

    const result = await handler.execute(validCommand())

    // The API reports pending at creation, regardless of the provider's answer.
    assert.equal(result.status, 'pending')
    assert.match(result.paymentId, /^[0-9a-f-]{36}$/)

    // The provider was called exactly once with our payment.
    assert.lengthOf(provider.initiateCalls, 1)

    // Persisted twice: insert as pending, then update with the provider tx id.
    assert.equal(repo.saveCalls, 2)
    const stored = await repo.findById(result.paymentId)
    assert.equal(stored?.status.value, 'pending')
    assert.equal(stored?.providerTxId, 'tx_777')
  })

  test('marks the payment failed and raises ProviderUnavailableError on provider error', async ({
    assert,
  }) => {
    const repo = new InMemoryPaymentRepository()
    const provider = new FakePaymentProvider({ initiateError: new Error('connection reset') })
    const handler = new InitiatePaymentHandler(repo, provider)

    let raised: unknown
    try {
      await handler.execute(validCommand())
    } catch (error) {
      raised = error
    }

    assert.instanceOf(raised, ProviderUnavailableError)

    const stored = [...repo.store.values()]
    assert.lengthOf(stored, 1)
    assert.equal(stored[0].status.value, 'failed')
    assert.equal(repo.saveCalls, 2) // pending, then failed
  })

  test('re-throws a ProviderUnavailableError unchanged', async ({ assert }) => {
    const original = new ProviderUnavailableError('provider is down')
    const repo = new InMemoryPaymentRepository()
    const provider = new FakePaymentProvider({ initiateError: original })
    const handler = new InitiatePaymentHandler(repo, provider)

    let raised: unknown
    try {
      await handler.execute(validCommand())
    } catch (error) {
      raised = error
    }

    assert.strictEqual(raised, original)
  })

  test('rejects an unsupported method before touching repository or provider', async ({
    assert,
  }) => {
    const repo = new InMemoryPaymentRepository()
    const provider = new FakePaymentProvider()
    const handler = new InitiatePaymentHandler(repo, provider)

    let raised: unknown
    try {
      await handler.execute(new InitiatePaymentCommand(3452, 'BRL', 'BITCOIN', PRODUCT_ID))
    } catch (error) {
      raised = error
    }

    assert.instanceOf(raised, InvalidPaymentMethodError)
    assert.equal(repo.saveCalls, 0)
    assert.lengthOf(provider.initiateCalls, 0)
  })
})
