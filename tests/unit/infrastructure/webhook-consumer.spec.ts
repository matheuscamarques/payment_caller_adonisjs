import { test } from '@japa/runner'
import nock from 'nock'
import { WebhookConsumer } from '#payments/infrastructure/messaging/webhook-consumer'
import { KafkaConfig } from '#config/kafka'

class FakeLogger {
  public debugs: any[] = []
  public infos: any[] = []
  public warns: any[] = []
  public errors: any[] = []

  debug(msg: any, details?: any) {
    this.debugs.push({ msg, details })
  }
  info(msg: any, details?: any) {
    this.infos.push({ msg, details })
  }
  warn(msg: any, details?: any) {
    this.warns.push({ msg, details })
  }
  error(msg: any, details?: any) {
    this.errors.push({ msg, details })
  }
}

test.group('WebhookConsumer', (group) => {
  group.each.setup(() => {
    nock.disableNetConnect()
    nock.enableNetConnect((host) => host.includes('127.0.0.1') || host.includes('localhost'))
    return () => {
      nock.cleanAll()
      nock.enableNetConnect()
    }
  })

  test('successfully dispatches a webhook', async ({ assert }) => {
    const config: KafkaConfig = {
      bootstrapServers: ['localhost:9092'],
      clientId: 'test',
      groupId: 'test-group',
      topic: 'test-topic',
    }
    const logger = new FakeLogger()
    const consumer = new WebhookConsumer(config, logger as any, 3, 1)

    const url = 'http://client.webhook.com/callback'
    const payload = { paymentId: 'p1', status: 'processed' }

    const mockReq = nock('http://client.webhook.com').post('/callback', payload).reply(200, {})

    await (consumer as any).dispatchWebhookWithRetries(url, payload)

    assert.isTrue(mockReq.isDone())
    assert.equal(logger.infos.length, 1)
    assert.include(logger.infos[0].msg, 'Webhook successfully dispatched')
  })

  test('retries transient failures and succeeds', async ({ assert }) => {
    const config: KafkaConfig = {
      bootstrapServers: ['localhost:9092'],
      clientId: 'test',
      groupId: 'test-group',
      topic: 'test-topic',
    }
    const logger = new FakeLogger()
    const consumer = new WebhookConsumer(config, logger as any, 3, 1) // 3 retries, 1ms delay

    const url = 'http://client.webhook.com/callback'
    const payload = { paymentId: 'p1', status: 'processed' }

    const mockReq1 = nock('http://client.webhook.com').post('/callback', payload).reply(500)
    const mockReq2 = nock('http://client.webhook.com').post('/callback', payload).reply(503)
    const mockReq3 = nock('http://client.webhook.com').post('/callback', payload).reply(200, {})

    await (consumer as any).dispatchWebhookWithRetries(url, payload)

    assert.isTrue(mockReq1.isDone())
    assert.isTrue(mockReq2.isDone())
    assert.isTrue(mockReq3.isDone())
    assert.equal(logger.infos.length, 1)
    assert.equal(logger.warns.length, 2)
  })

  test('logs error and stops retrying when max attempts are exceeded', async ({ assert }) => {
    const config: KafkaConfig = {
      bootstrapServers: ['localhost:9092'],
      clientId: 'test',
      groupId: 'test-group',
      topic: 'test-topic',
    }
    const logger = new FakeLogger()
    const consumer = new WebhookConsumer(config, logger as any, 2, 1) // max 2 retries (total 3 attempts)

    const url = 'http://client.webhook.com/callback'
    const payload = { paymentId: 'p1', status: 'processed' }

    const mockReq1 = nock('http://client.webhook.com').post('/callback', payload).reply(500)
    const mockReq2 = nock('http://client.webhook.com').post('/callback', payload).reply(500)
    const mockReq3 = nock('http://client.webhook.com').post('/callback', payload).reply(500)

    await (consumer as any).dispatchWebhookWithRetries(url, payload)

    assert.isTrue(mockReq1.isDone())
    assert.isTrue(mockReq2.isDone())
    assert.isTrue(mockReq3.isDone())
    assert.equal(logger.errors.length, 1)
    assert.include(logger.errors[0].msg.error.message, 'status code 500')
  })
})
