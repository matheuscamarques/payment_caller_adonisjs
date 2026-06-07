import { Kafka, Consumer } from 'kafkajs'
import axios from 'axios'
import { Logger } from '@adonisjs/core/logger'
import { KafkaConfig } from '#config/kafka'

/**
 * Background consumer that listens to the `payment-status-changed` Kafka topic.
 *
 * For each event, it triggers a POST HTTP request to the client-configured
 * `webhookUrl`. It implements robust retries with exponential backoff if
 * the webhook endpoint returns a non-2xx status code or times out.
 */
export class WebhookConsumer {
  private readonly kafka: Kafka
  private readonly consumer: Consumer
  private isRunning = false

  constructor(
    private readonly config: KafkaConfig,
    private readonly logger: Logger,
    private readonly maxRetries = 3,
    private readonly initialDelayMs = 100
  ) {
    this.kafka = new Kafka({
      clientId: `${this.config.clientId}-consumer`,
      brokers: this.config.bootstrapServers,
    })
    this.consumer = this.kafka.consumer({ groupId: this.config.groupId })
  }

  /** Starts the consumer to begin listening for events. */
  async start(): Promise<void> {
    if (this.isRunning) {
      return
    }
    this.isRunning = true

    await this.consumer.connect()
    await this.consumer.subscribe({ topic: this.config.topic, fromBeginning: false })

    await this.consumer.run({
      eachMessage: async ({ message }) => {
        const value = message.value?.toString()
        if (!value) {
          return
        }

        try {
          const event = JSON.parse(value)
          this.logger.debug({ event }, 'Received payment status changed event')

          if (!event.webhookUrl) {
            this.logger.info(`No webhook URL configured for payment ${event.paymentId}. Skipping.`)
            return
          }

          await this.dispatchWebhookWithRetries(event.webhookUrl, event)
        } catch (error) {
          this.logger.error({ error }, 'Failed to process webhook consumer message')
        }
      },
    })

    this.logger.info('Kafka Webhook Consumer started successfully.')
  }

  /** Stops the consumer and disconnects gracefully from Kafka. */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return
    }
    await this.consumer.disconnect()
    this.isRunning = false
    this.logger.info('Kafka Webhook Consumer stopped.')
  }

  private async dispatchWebhookWithRetries(url: string, payload: any): Promise<void> {
    let attempt = 0
    let delay = this.initialDelayMs

    while (attempt <= this.maxRetries) {
      try {
        attempt++
        this.logger.debug(`Dispatching webhook to ${url} (attempt ${attempt})...`)
        await axios.post(url, payload, { timeout: 5000 })
        this.logger.info(
          `Webhook successfully dispatched to ${url} for payment ${payload.paymentId}`
        )
        return
      } catch (error) {
        if (attempt > this.maxRetries) {
          this.logger.error(
            { error },
            `Failed to dispatch webhook to ${url} for payment ${payload.paymentId} after ${attempt} attempts.`
          )
          return
        }
        this.logger.warn(`Webhook attempt ${attempt} to ${url} failed. Retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= 2
      }
    }
  }
}
