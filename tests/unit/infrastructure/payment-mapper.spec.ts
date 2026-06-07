import { test } from '@japa/runner'
import { PaymentMapper } from '#payments/infrastructure/persistence/mappers/payment.mapper'
import { Payment } from '#payments/domain/entities/payment'
import { Money } from '#payments/domain/value-objects/money'
import { PaymentMethod } from '#payments/domain/value-objects/payment-method'
import { PaymentStatus } from '#payments/domain/value-objects/payment-status'

const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'

test.group('PaymentMapper', () => {
  test('maps a domain payment to persistence attributes', ({ assert }) => {
    const payment = Payment.restore({
      paymentId: 'p1',
      money: Money.create(3452, 'BRL'),
      method: PaymentMethod.fromString('PAYPAL'),
      productId: PRODUCT_ID,
      status: PaymentStatus.pending(),
      providerTxId: 'tx_1',
    })

    assert.deepEqual(PaymentMapper.toPersistence(payment), {
      paymentId: 'p1',
      amount: 3452,
      currency: 'BRL',
      method: 'PAYPAL',
      status: 'pending',
      productId: PRODUCT_ID,
      providerTxId: 'tx_1',
    })
  })

  test('rebuilds a domain payment from a persisted record', ({ assert }) => {
    const payment = PaymentMapper.toDomain({
      paymentId: 'p2',
      amount: 999,
      currency: 'USD',
      method: 'PIX',
      status: 'processed',
      productId: PRODUCT_ID,
      providerTxId: null,
    })

    assert.equal(payment.paymentId, 'p2')
    assert.equal(payment.money.amount, 999)
    assert.equal(payment.money.currency, 'USD')
    assert.equal(payment.method.value, 'PIX')
    assert.equal(payment.status.value, 'processed')
    assert.isNull(payment.providerTxId)
  })

  test('round-trips a payment without loss', ({ assert }) => {
    const original = Payment.restore({
      paymentId: 'p3',
      money: Money.create(150, 'EUR'),
      method: PaymentMethod.fromString('CREDIT_CARD'),
      productId: PRODUCT_ID,
      status: PaymentStatus.fromString('failed'),
      providerTxId: 'tx_3',
    })

    const roundTripped = PaymentMapper.toDomain(PaymentMapper.toPersistence(original))

    assert.deepEqual(
      PaymentMapper.toPersistence(roundTripped),
      PaymentMapper.toPersistence(original)
    )
  })
})
