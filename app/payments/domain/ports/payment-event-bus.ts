import { Payment } from '../entities/payment.js'

/**
 * Driven port: event bus for publishing payment domain events.
 *
 * Keeps our core domain and application handlers decoupled from specific
 * messaging technologies (like Kafka, RabbitMQ, or SNS). Concrete adapters
 * implement this class.
 */
export abstract class PaymentEventBus {
  /** Publish an event indicating a payment's status has transitioned. */
  abstract publishStatusChanged(payment: Payment): Promise<void>
}
