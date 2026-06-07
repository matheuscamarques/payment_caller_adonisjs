import { Payment } from '../../domain/entities/payment.js'
import { PaymentEventBus } from '../../domain/ports/payment-event-bus.js'

/**
 * In-memory implementation of the PaymentEventBus port.
 *
 * Keeps track of published events in an array, making it ideal for unit and
 * integration testing without hitting a real Kafka broker.
 */
export class InMemoryPaymentEventBus extends PaymentEventBus {
  public publishedEvents: Payment[] = []

  async publishStatusChanged(payment: Payment): Promise<void> {
    this.publishedEvents.push(payment)
  }

  /** Clears the log of published events (useful between test cases). */
  clear(): void {
    this.publishedEvents = []
  }
}
