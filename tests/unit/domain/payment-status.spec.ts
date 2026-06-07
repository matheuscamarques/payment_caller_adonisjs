import { test } from '@japa/runner'
import { PaymentStatus } from '#payments/domain/value-objects/payment-status'
import { InvalidPaymentStatusError } from '#payments/domain/errors/invalid-payment-data.error'

test.group('PaymentStatus', () => {
  test('builds the pending and failed factories', ({ assert }) => {
    assert.equal(PaymentStatus.pending().value, 'pending')
    assert.equal(PaymentStatus.failed().value, 'failed')
  })

  test('builds from a valid string', ({ assert }) => {
    assert.equal(PaymentStatus.fromString('processed').value, 'processed')
  })

  test('rejects an invalid status', ({ assert }) => {
    assert.throws(() => PaymentStatus.fromString('refunded'))
    try {
      PaymentStatus.fromString('refunded')
    } catch (error) {
      assert.instanceOf(error, InvalidPaymentStatusError)
    }
  })

  test('knows which states are terminal', ({ assert }) => {
    assert.isTrue(PaymentStatus.fromString('processed').isFinal())
    assert.isTrue(PaymentStatus.fromString('failed').isFinal())
    assert.isFalse(PaymentStatus.pending().isFinal())
  })

  test('knows the pending state', ({ assert }) => {
    assert.isTrue(PaymentStatus.pending().isPending())
    assert.isFalse(PaymentStatus.failed().isPending())
  })

  test('compares by value', ({ assert }) => {
    assert.isTrue(PaymentStatus.pending().equals(PaymentStatus.fromString('pending')))
    assert.isFalse(PaymentStatus.pending().equals(PaymentStatus.failed()))
    assert.equal(PaymentStatus.pending().toString(), 'pending')
  })
})
