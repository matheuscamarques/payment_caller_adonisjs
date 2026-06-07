import { test } from '@japa/runner'
import { PaymentMethod, PAYMENT_METHODS } from '#payments/domain/value-objects/payment-method'
import { InvalidPaymentMethodError } from '#payments/domain/errors/invalid-payment-data.error'

test.group('PaymentMethod', () => {
  for (const value of PAYMENT_METHODS) {
    test(`accepts the supported method ${value}`, ({ assert }) => {
      const method = PaymentMethod.fromString(value)
      assert.equal(method.value, value)
      assert.equal(method.toString(), value)
    })
  }

  test('rejects an unsupported method', ({ assert }) => {
    assert.throws(() => PaymentMethod.fromString('BITCOIN'))
    try {
      PaymentMethod.fromString('BITCOIN')
    } catch (error) {
      assert.instanceOf(error, InvalidPaymentMethodError)
    }
  })

  test('compares by value', ({ assert }) => {
    assert.isTrue(PaymentMethod.fromString('PAYPAL').equals(PaymentMethod.fromString('PAYPAL')))
    assert.isFalse(PaymentMethod.fromString('PAYPAL').equals(PaymentMethod.fromString('PIX')))
  })
})
