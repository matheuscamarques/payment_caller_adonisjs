import { test } from '@japa/runner'
import { Money } from '#payments/domain/value-objects/money'
import { InvalidMoneyError } from '#payments/domain/errors/invalid-payment-data.error'

test.group('Money', () => {
  test('creates a valid money in minor units', ({ assert }) => {
    const money = Money.create(3452, 'BRL')
    assert.equal(money.amount, 3452)
    assert.equal(money.currency, 'BRL')
  })

  test('rejects a zero amount (charges must be positive)', ({ assert }) => {
    assert.throws(() => Money.create(0, 'USD'))
  })

  test('normalises the currency to upper case', ({ assert }) => {
    assert.equal(Money.create(100, 'brl').currency, 'BRL')
  })

  test('rejects a negative amount', ({ assert }) => {
    assert.throws(
      () => Money.create(-1, 'BRL'),
      'Amount must be a positive integer in minor units, received: -1'
    )
  })

  test('rejects a non-integer amount', ({ assert }) => {
    assert.throws(() => Money.create(34.52, 'BRL'))
    try {
      Money.create(34.52, 'BRL')
    } catch (error) {
      assert.instanceOf(error, InvalidMoneyError)
    }
  })

  test('rejects an invalid currency code', ({ assert }) => {
    assert.throws(() => Money.create(100, 'REAL'))
    assert.throws(() => Money.create(100, 'BR'))
    assert.throws(() => Money.create(100, '12'))
  })

  test('compares by value', ({ assert }) => {
    assert.isTrue(Money.create(100, 'BRL').equals(Money.create(100, 'BRL')))
    assert.isFalse(Money.create(100, 'BRL').equals(Money.create(200, 'BRL')))
    assert.isFalse(Money.create(100, 'BRL').equals(Money.create(100, 'USD')))
  })
})
