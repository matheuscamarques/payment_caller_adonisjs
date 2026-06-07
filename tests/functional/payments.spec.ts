import { test } from '@japa/runner'
import nock from 'nock'
import PaymentModel from '#payments/infrastructure/persistence/models/payment_model'

const PROVIDER_URL = 'http://external.provider.com'
const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'
const TX_ID = 'b018b23b-9931-4438-b55f-782edb05b4c2'

const validPayload = {
  amount: 3452,
  currency: 'BRL',
  method: 'PAYPAL',
  product_id: PRODUCT_ID,
}

/**
 * End-to-end tests of the public API. They boot the real HTTP server and a real
 * PostgreSQL (Testcontainers); only the external provider is mocked (nock).
 * Local connections to the test server are allowed; everything else is blocked
 * so an un-mocked outbound call fails loudly instead of hitting the network.
 */
test.group('Payments API', (group) => {
  group.each.setup(() => {
    nock.disableNetConnect()
    nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'))
    return () => {
      nock.cleanAll()
      nock.enableNetConnect()
    }
  })

  test('POST /api/v1/payments initiates a payment and returns pending', async ({
    client,
    assert,
  }) => {
    const init = nock(PROVIDER_URL)
      .post('/init-payment')
      .reply(200, { tx_id: TX_ID, status: 'processed' })

    const response = await client.post('/api/v1/payments').json(validPayload)

    response.assertStatus(201)
    assert.equal(response.body().status, 'pending')
    assert.match(response.body().paymentId, /^[0-9a-f-]{36}$/)
    assert.isTrue(init.isDone())
  })

  /**
   * Each field is validated independently, so we send the valid payload with
   * exactly one field broken per case. A single combined invalid payload could
   * keep returning 422 even if all-but-one rule regressed (a false green).
   */
  const invalidPayloads: Record<string, Record<string, unknown>> = {
    'a negative amount': { ...validPayload, amount: -5 },
    'a zero amount': { ...validPayload, amount: 0 },
    'a non-integer amount': { ...validPayload, amount: 12.5 },
    'a malformed currency': { ...validPayload, currency: 'REAL' },
    'an unsupported method': { ...validPayload, method: 'BITCOIN' },
    'a non-uuid product_id': { ...validPayload, product_id: 'not-a-uuid' },
  }

  for (const [description, payload] of Object.entries(invalidPayloads)) {
    test(`POST /api/v1/payments rejects ${description} with 422`, async ({ client }) => {
      const response = await client.post('/api/v1/payments').json(payload)
      response.assertStatus(422)
    })
  }

  test('POST /api/v1/payments returns 502 and persists the payment as failed when the provider is down', async ({
    client,
    assert,
  }) => {
    nock(PROVIDER_URL).post('/init-payment').reply(503, {})

    const response = await client.post('/api/v1/payments').json(validPayload)

    response.assertStatus(502)

    // The fail-fast side effect round-trips through real Postgres.
    const failed = await PaymentModel.query().where('status', 'failed')
    assert.lengthOf(failed, 1)
    assert.isNull(failed[0].providerTxId)
  })

  test('GET /api/v1/payments/:id returns 404 for an unknown payment', async ({ client }) => {
    const response = await client.get(`/api/v1/payments/${TX_ID}`)
    response.assertStatus(404)
  })

  test('GET /api/v1/payments/:id returns 502 when the provider fails during status sync', async ({
    client,
  }) => {
    nock(PROVIDER_URL).post('/init-payment').reply(200, { tx_id: TX_ID, status: 'pending' })
    const created = await client.post('/api/v1/payments').json(validPayload)
    created.assertStatus(201)
    const paymentId = created.body().paymentId

    nock(PROVIDER_URL).get(`/list-payment/${TX_ID}`).reply(503, {})
    const status = await client.get(`/api/v1/payments/${paymentId}`)

    status.assertStatus(502)
  })

  test('full flow: initiate then check status reconciles to processed', async ({
    client,
    assert,
  }) => {
    nock(PROVIDER_URL).post('/init-payment').reply(200, { tx_id: TX_ID, status: 'pending' })
    const created = await client.post('/api/v1/payments').json(validPayload)
    created.assertStatus(201)
    const paymentId = created.body().paymentId

    const list = nock(PROVIDER_URL)
      .get(`/list-payment/${TX_ID}`)
      .reply(200, { tx_id: TX_ID, status: 'processed' })
    const status = await client.get(`/api/v1/payments/${paymentId}`)

    status.assertStatus(200)
    assert.equal(status.body().paymentId, paymentId)
    assert.equal(status.body().status, 'processed')
    assert.isTrue(list.isDone()) // the GET must hit the provider to reconcile
  })

  test('full flow: GET reconciles a provider "failed" status against real Postgres', async ({
    client,
    assert,
  }) => {
    nock(PROVIDER_URL).post('/init-payment').reply(200, { tx_id: TX_ID, status: 'pending' })
    const created = await client.post('/api/v1/payments').json(validPayload)
    const paymentId = created.body().paymentId

    nock(PROVIDER_URL).get(`/list-payment/${TX_ID}`).reply(200, { tx_id: TX_ID, status: 'failed' })
    const status = await client.get(`/api/v1/payments/${paymentId}`)

    status.assertStatus(200)
    assert.equal(status.body().status, 'failed')
  })

  test('GET /swagger.json returns the openapi specification', async ({ client }) => {
    const response = await client.get('/swagger.json')
    response.assertStatus(200)
    response.assertBodyContains({ openapi: '3.0.3' })
  })

  test('GET /docs returns the Swagger UI html page', async ({ client }) => {
    const response = await client.get('/docs')
    response.assertStatus(200)
    response.assertTextIncludes('<div id="swagger-ui"></div>')
  })
})
