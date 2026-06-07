import { test } from '@japa/runner'
import { ProviderMapper } from '#payments/infrastructure/provider/provider.mapper'
import { Payment } from '#payments/domain/entities/payment'
import { Money } from '#payments/domain/value-objects/money'
import { PaymentMethod } from '#payments/domain/value-objects/payment-method'
import { ProviderUnavailableError } from '#payments/domain/errors/provider-unavailable.error'

const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'

test.group('ProviderMapper (anti-corruption layer)', () => {
  test('builds the init request with nested money and the translated method', ({ assert }) => {
    const payment = Payment.initiate({
      money: Money.create(3452, 'BRL'),
      method: PaymentMethod.fromString('PAYPAL'),
      productId: PRODUCT_ID,
    })

    assert.deepEqual(ProviderMapper.toInitRequest(payment), {
      money: { amount: 3452, currency: 'BRL' },
      payment_method: 'pay-pal',
      product_id: PRODUCT_ID,
    })
  })

  test('translates every supported payment method', ({ assert }) => {
    assert.equal(ProviderMapper.toProviderMethod('PAYPAL'), 'pay-pal')
    assert.equal(ProviderMapper.toProviderMethod('CREDIT_CARD'), 'credit-card')
    assert.equal(ProviderMapper.toProviderMethod('PIX'), 'pix')
  })

  test('maps the provider status vocabulary onto ours (case-insensitively)', ({ assert }) => {
    assert.equal(ProviderMapper.toDomainStatus('processed'), 'processed')
    assert.equal(ProviderMapper.toDomainStatus('PROCESSED'), 'processed')
    assert.equal(ProviderMapper.toDomainStatus('succeeded'), 'processed')
    assert.equal(ProviderMapper.toDomainStatus('pending'), 'pending')
    assert.equal(ProviderMapper.toDomainStatus('processing'), 'pending')
    assert.equal(ProviderMapper.toDomainStatus('in_progress'), 'pending')
    assert.equal(ProviderMapper.toDomainStatus('failed'), 'failed')
    assert.equal(ProviderMapper.toDomainStatus('declined'), 'failed')
    assert.equal(ProviderMapper.toDomainStatus('canceled'), 'failed')
  })

  test('rejects an unrecognised provider status', ({ assert }) => {
    let raised: unknown
    try {
      ProviderMapper.toDomainStatus('teleported')
    } catch (error) {
      raised = error
    }
    assert.instanceOf(raised, ProviderUnavailableError)
  })

  test('maps a full provider response into a domain initiation', ({ assert }) => {
    assert.deepEqual(
      ProviderMapper.toInitiation({
        tx_id: 'b018b23b-9931-4438-b55f-782edb05b4c2',
        status: 'processed',
      }),
      { providerTxId: 'b018b23b-9931-4438-b55f-782edb05b4c2', status: 'processed' }
    )
  })
})
