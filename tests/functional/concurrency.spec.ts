import { test } from '@japa/runner'
import nock from 'nock'

const PROVIDER_URL = 'http://external.provider.com'
const PRODUCT_ID = '87e9646a-8513-465d-b58d-6df44b9e4925'
const TX_ID = 'b018b23b-9931-4438-b55f-782edb05b4c2'

const validPayload = {
  amount: 3452,
  currency: 'BRL',
  method: 'PAYPAL',
  product_id: PRODUCT_ID,
}

test.group('Payments API Concurrency', (group) => {
  group.each.setup(() => {
    nock.disableNetConnect()
    nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'))
    return () => {
      nock.cleanAll()
      nock.enableNetConnect()
    }
  })

  test('coalesces multiple concurrent GET status checks into a single provider call', async ({
    client,
    assert,
  }) => {
    // 1. Initiate a payment first
    const initMock = nock(PROVIDER_URL)
      .post('/init-payment')
      .reply(200, { tx_id: TX_ID, status: 'pending' })

    const created = await client.post('/api/v1/payments').json(validPayload)
    created.assertStatus(201)
    const paymentId = created.body().paymentId
    assert.isTrue(initMock.isDone())

    // 2. Mock a single GET status call to the provider, delaying it to simulate network latency
    // By default, nock interceptors are consumed after one call.
    // If our server tries to make a second concurrent call, nock will throw a net connect error,
    // causing a 502 response for one of the concurrent clients.
    const statusMock = nock(PROVIDER_URL)
      .get(`/list-payment/${TX_ID}`)
      .delay(50) // delay the response by 50ms to ensure concurrent requests overlap
      .reply(200, { tx_id: TX_ID, status: 'processed' })

    // 3. Issue two status check requests concurrently
    const [response1, response2] = await Promise.all([
      client.get(`/api/v1/payments/${paymentId}`),
      client.get(`/api/v1/payments/${paymentId}`),
    ])

    // 4. Verify both requests completed successfully and got the same result
    response1.assertStatus(200)
    response2.assertStatus(200)

    assert.equal(response1.body().status, 'processed')
    assert.equal(response2.body().status, 'processed')

    // Verify the mock was consumed (meaning exactly 1 external call was made)
    assert.isTrue(statusMock.isDone())
  })
})
