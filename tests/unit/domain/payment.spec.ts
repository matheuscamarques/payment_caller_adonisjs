import { test } from '@japa/runner'
import { Payment } from '#payments/domain/entities/payment'
import { Money } from '#payments/domain/value-objects/money'
import { PaymentMethod } from '#payments/domain/value-objects/payment-method'
import { PaymentStatus } from '#payments/domain/value-objects/payment-status'

const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'

function buildInitiated() {
  return Payment.initiate({
    money: Money.create(3452, 'BRL'),
    method: PaymentMethod.fromString('PAYPAL'),
    productId: PRODUCT_ID,
  })
}

test.group('Payment', () => {
  test('initiates a payment as pending with a generated id and no provider link', ({ assert }) => {
    const payment = buildInitiated()

    assert.match(payment.paymentId, /^[0-9a-f-]{36}$/)
    assert.equal(payment.status.value, 'pending')
    assert.isNull(payment.providerTxId)
    assert.equal(payment.money.amount, 3452)
    assert.equal(payment.method.value, 'PAYPAL')
    assert.equal(payment.productId, PRODUCT_ID)
  })

  test('does not need a provider sync until linked', ({ assert }) => {
    const payment = buildInitiated()
    assert.isFalse(payment.needsProviderSync())
  })

  test('needs a provider sync once linked and still pending', ({ assert }) => {
    const payment = buildInitiated()
    payment.linkToProvider('tx_123')

    assert.equal(payment.providerTxId, 'tx_123')
    assert.isTrue(payment.needsProviderSync())
  })

  test('reconciles its status and stops needing a sync when terminal', ({ assert }) => {
    const payment = buildInitiated()
    payment.linkToProvider('tx_123')

    payment.syncStatus('processed')

    assert.equal(payment.status.value, 'processed')
    assert.isTrue(payment.status.isFinal())
    assert.isFalse(payment.needsProviderSync())
  })

  test('can be marked as failed', ({ assert }) => {
    const payment = buildInitiated()
    payment.markAsFailed()
    assert.equal(payment.status.value, 'failed')
    assert.isFalse(payment.needsProviderSync())
  })

  test('restores an aggregate from persisted state', ({ assert }) => {
    const payment = Payment.restore({
      paymentId: 'b018b23b-9931-4438-b55f-782edb05b4c2',
      money: Money.create(999, 'USD'),
      method: PaymentMethod.fromString('CREDIT_CARD'),
      productId: PRODUCT_ID,
      status: PaymentStatus.fromString('processed'),
      providerTxId: 'tx_abc',
      webhookUrl: 'http://example.com/webhook',
    })

    assert.equal(payment.paymentId, 'b018b23b-9931-4438-b55f-782edb05b4c2')
    assert.equal(payment.status.value, 'processed')
    assert.equal(payment.providerTxId, 'tx_abc')
    assert.equal(payment.webhookUrl, 'http://example.com/webhook')
  })

  test('can be initiated with a webhook URL', ({ assert }) => {
    const payment = Payment.initiate({
      money: Money.create(3452, 'BRL'),
      method: PaymentMethod.fromString('PAYPAL'),
      productId: PRODUCT_ID,
      webhookUrl: 'http://example.com/webhook',
    })

    assert.equal(payment.webhookUrl, 'http://example.com/webhook')
  })
})
