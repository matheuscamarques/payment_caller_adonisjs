import { Kafka, Producer } from 'kafkajs'
import { Payment } from '../../domain/entities/payment.js'
import { PaymentEventBus } from '../../domain/ports/payment-event-bus.js'
import { KafkaConfig } from '#config/kafka'

/**
 * Kafka-backed implementation of the PaymentEventBus port (a driven adapter).
 * Serializes payment events to JSON and publishes them to the configured Kafka topic.
 */
export class KafkaPaymentEventBus extends PaymentEventBus {
  private readonly kafka: Kafka
  private readonly producer: Producer
  private isConnected = false

  constructor(private readonly config: KafkaConfig) {
    super()
    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.bootstrapServers,
    })
    this.producer = this.kafka.producer()
  }

  /** Connect the producer if it hasn't been connected yet. */
  async connect(): Promise<void> {
    if (this.isConnected) {
      return
    }
    await this.producer.connect()
    this.isConnected = true
  }

  /** Clean up connection. */
  async disconnect(): Promise<void> {
    if (!this.isConnected) {
      return
    }
    await this.producer.disconnect()
    this.isConnected = false
  }

  async publishStatusChanged(payment: Payment): Promise<void> {
    await this.connect()

    const payload = {
      paymentId: payment.paymentId,
      productId: payment.productId,
      amount: payment.money.amount,
      currency: payment.money.currency,
      status: payment.status.value,
      webhookUrl: payment.webhookUrl,
      timestamp: new Date().toISOString(),
    }

    await this.producer.send({
      topic: this.config.topic,
      messages: [
        {
          key: payment.paymentId,
          value: JSON.stringify(payload),
        },
      ],
    })
  }
}
