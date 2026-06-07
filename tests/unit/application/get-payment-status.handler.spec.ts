import { test } from '@japa/runner'
import { GetPaymentStatusHandler } from '#payments/application/queries/get-payment-status/get-payment-status.handler'
import { GetPaymentStatusQuery } from '#payments/application/queries/get-payment-status/get-payment-status.query'
import { PaymentNotFoundError } from '#payments/domain/errors/payment-not-found.error'
import { ProviderUnavailableError } from '#payments/domain/errors/provider-unavailable.error'
import { Payment } from '#payments/domain/entities/payment'
import { Money } from '#payments/domain/value-objects/money'
import { PaymentMethod } from '#payments/domain/value-objects/payment-method'
import { PaymentStatus } from '#payments/domain/value-objects/payment-status'
import { InMemoryPaymentRepository, FakePaymentProvider } from '#tests/helpers/payment_doubles'

const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'

function seed(
  repo: InMemoryPaymentRepository,
  status: PaymentStatus,
  providerTxId: string | null,
  paymentId = 'p1'
) {
  const payment = Payment.restore({
    paymentId,
    money: Money.create(3452, 'BRL'),
    method: PaymentMethod.fromString('PAYPAL'),
    productId: PRODUCT_ID,
    status,
    providerTxId,
  })
  repo.store.set(paymentId, payment)
  return payment
}

test.group('GetPaymentStatusHandler', () => {
  test('raises PaymentNotFoundError when the payment is unknown', async ({ assert }) => {
    const repo = new InMemoryPaymentRepository()
    const provider = new FakePaymentProvider()
    const handler = new GetPaymentStatusHandler(repo, provider)

    let raised: unknown
    try {
      await handler.execute(new GetPaymentStatusQuery('missing'))
    } catch (error) {
      raised = error
    }

    assert.instanceOf(raised, PaymentNotFoundError)
    assert.lengthOf(provider.fetchStatusCalls, 0)
  })

  test('syncs a pending payment from the provider and persists the new status', async ({
    assert,
  }) => {
    const repo = new InMemoryPaymentRepository()
    seed(repo, PaymentStatus.pending(), 'tx_1')
    const provider = new FakePaymentProvider({ status: 'processed' })
    const handler = new GetPaymentStatusHandler(repo, provider)

    const result = await handler.execute(new GetPaymentStatusQuery('p1'))

    assert.equal(result.paymentId, 'p1')
    assert.equal(result.status, 'processed')
    assert.deepEqual(provider.fetchStatusCalls, ['tx_1'])
    const stored = await repo.findById('p1')
    assert.equal(stored?.status.value, 'processed')
  })

  test('does not call the provider for a terminal status', async ({ assert }) => {
    const repo = new InMemoryPaymentRepository()
    seed(repo, PaymentStatus.fromString('processed'), 'tx_2')
    const provider = new FakePaymentProvider({ status: 'failed' })
    const handler = new GetPaymentStatusHandler(repo, provider)

    const result = await handler.execute(new GetPaymentStatusQuery('p1'))

    assert.equal(result.status, 'processed')
    assert.lengthOf(provider.fetchStatusCalls, 0)
  })

  test('does not call the provider when the payment is not linked', async ({ assert }) => {
    const repo = new InMemoryPaymentRepository()
    seed(repo, PaymentStatus.pending(), null)
    const provider = new FakePaymentProvider({ status: 'processed' })
    const handler = new GetPaymentStatusHandler(repo, provider)

    const result = await handler.execute(new GetPaymentStatusQuery('p1'))

    assert.equal(result.status, 'pending')
    assert.lengthOf(provider.fetchStatusCalls, 0)
  })

  test('propagates a provider failure while syncing', async ({ assert }) => {
    const repo = new InMemoryPaymentRepository()
    seed(repo, PaymentStatus.pending(), 'tx_3')
    const provider = new FakePaymentProvider({
      fetchError: new ProviderUnavailableError('provider is down'),
    })
    const handler = new GetPaymentStatusHandler(repo, provider)

    let raised: unknown
    try {
      await handler.execute(new GetPaymentStatusQuery('p1'))
    } catch (error) {
      raised = error
    }

    assert.instanceOf(raised, ProviderUnavailableError)
  })
})
