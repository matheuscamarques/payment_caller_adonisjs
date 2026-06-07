import { test } from '@japa/runner'
import { LucidPaymentRepository } from '#payments/infrastructure/persistence/lucid-payment.repository'
import { Payment } from '#payments/domain/entities/payment'
import { Money } from '#payments/domain/value-objects/money'
import { PaymentMethod } from '#payments/domain/value-objects/payment-method'

const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'

/**
 * Integration test for the persistence adapter against a real PostgreSQL
 * instance booted by Testcontainers (see tests/helpers/test_database.ts). Tables
 * are truncated between tests by `configureSuite` in tests/bootstrap.ts.
 */
test.group('LucidPaymentRepository (real Postgres)', () => {
  test('persists a new payment and reads it back faithfully', async ({ assert }) => {
    const repo = new LucidPaymentRepository()
    const payment = Payment.initiate({
      money: Money.create(3452, 'BRL'),
      method: PaymentMethod.fromString('PAYPAL'),
      productId: PRODUCT_ID,
    })

    await repo.save(payment)
    const found = await repo.findById(payment.paymentId)

    assert.isNotNull(found)
    assert.equal(found!.paymentId, payment.paymentId)
    assert.equal(found!.money.amount, 3452)
    assert.equal(found!.money.currency, 'BRL')
    assert.equal(found!.method.value, 'PAYPAL')
    assert.equal(found!.productId, PRODUCT_ID)
    assert.equal(found!.status.value, 'pending')
    assert.isNull(found!.providerTxId)
  })

  test('upserts the same payment by business id (insert then update)', async ({ assert }) => {
    const repo = new LucidPaymentRepository()
    const payment = Payment.initiate({
      money: Money.create(100, 'USD'),
      method: PaymentMethod.fromString('PIX'),
      productId: PRODUCT_ID,
    })
    await repo.save(payment)

    payment.linkToProvider('tx_999')
    payment.syncStatus('processed')
    await repo.save(payment)

    const found = await repo.findById(payment.paymentId)
    assert.equal(found!.providerTxId, 'tx_999')
    assert.equal(found!.status.value, 'processed')
  })

  test('returns null for an unknown payment id', async ({ assert }) => {
    const repo = new LucidPaymentRepository()
    assert.isNull(await repo.findById('b018b23b-9931-4438-b55f-782edb05b4c2'))
  })
})
