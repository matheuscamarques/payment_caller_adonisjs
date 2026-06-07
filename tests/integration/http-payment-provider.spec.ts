import { test } from '@japa/runner'
import nock from 'nock'
import axios from 'axios'
import { HttpPaymentProvider } from '#payments/infrastructure/provider/http-payment-provider'
import { Payment } from '#payments/domain/entities/payment'
import { Money } from '#payments/domain/value-objects/money'
import { PaymentMethod } from '#payments/domain/value-objects/payment-method'
import { ProviderUnavailableError } from '#payments/domain/errors/provider-unavailable.error'

const PROVIDER_URL = 'http://external.provider.com'
const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'
const TX_ID = 'b018b23b-9931-4438-b55f-782edb05b4c2'

function buildProvider() {
  return new HttpPaymentProvider(axios.create({ baseURL: PROVIDER_URL, timeout: 2000 }))
}

function buildPayment() {
  return Payment.initiate({
    money: Money.create(3452, 'BRL'),
    method: PaymentMethod.fromString('PAYPAL'),
    productId: PRODUCT_ID,
  })
}

/**
 * Integration test for the provider adapter. The external provider is mocked
 * with nock, letting us assert both the outgoing request shape (anti-corruption
 * translation) and the inbound mapping — without any real network.
 */
test.group('HttpPaymentProvider (provider mocked with nock)', (group) => {
  group.each.setup(() => {
    nock.disableNetConnect()
    return () => {
      nock.cleanAll()
      nock.enableNetConnect()
    }
  })

  test('initiates a payment, translating to and from the provider contract', async ({ assert }) => {
    let receivedBody: unknown
    const scope = nock(PROVIDER_URL)
      .post('/init-payment', (body) => {
        receivedBody = body
        return true
      })
      .reply(200, { tx_id: TX_ID, status: 'processed' })

    const result = await buildProvider().initiate(buildPayment())

    assert.isTrue(scope.isDone())
    assert.deepEqual(receivedBody, {
      money: { amount: 3452, currency: 'BRL' },
      payment_method: 'pay-pal',
      product_id: PRODUCT_ID,
    })
    assert.deepEqual(result, { providerTxId: TX_ID, status: 'processed' })
  })

  test('fetches and maps a payment status', async ({ assert }) => {
    nock(PROVIDER_URL).get('/list-payment/tx_1').reply(200, { tx_id: 'tx_1', status: 'processed' })

    const status = await buildProvider().fetchStatus('tx_1')

    assert.equal(status, 'processed')
  })

  test('raises ProviderUnavailableError on a 5xx response', async ({ assert }) => {
    nock(PROVIDER_URL).post('/init-payment').reply(503, { error: 'unavailable' })

    let raised: unknown
    try {
      await buildProvider().initiate(buildPayment())
    } catch (error) {
      raised = error
    }
    assert.instanceOf(raised, ProviderUnavailableError)
  })

  test('raises ProviderUnavailableError on a network error', async ({ assert }) => {
    nock(PROVIDER_URL)
      .get('/list-payment/tx_x')
      .replyWithError({ code: 'ECONNREFUSED', message: 'refused' })

    let raised: unknown
    try {
      await buildProvider().fetchStatus('tx_x')
    } catch (error) {
      raised = error
    }
    assert.instanceOf(raised, ProviderUnavailableError)
  })
})
