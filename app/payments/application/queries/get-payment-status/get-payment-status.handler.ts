import { QueryHandler } from '../../bus/query-bus.js'
import { PaymentResult } from '../../dto/payment-result.js'
import { PaymentRepository } from '../../../domain/ports/payment-repository.js'
import { PaymentProvider } from '../../../domain/ports/payment-provider.js'
import { PaymentEventBus } from '../../../domain/ports/payment-event-bus.js'
import { PaymentNotFoundError } from '../../../domain/errors/payment-not-found.error.js'
import { GetPaymentStatusQuery } from './get-payment-status.query.js'
import { SingleFlight } from '../../bus/single-flight.js'

/**
 * Use case: read a payment's status.
 *
 * When the payment is still pending and linked to a provider transaction, its
 * status is refreshed live from the provider and the reconciled value is
 * persisted before returning. Terminal statuses are returned as-is (no extra
 * provider call).
 *
 * Concurrency is handled via SingleFlight coalescing to prevent duplicate
 * live sync and database writes for the same payment ID.
 */
export class GetPaymentStatusHandler implements QueryHandler<GetPaymentStatusQuery, PaymentResult> {
  private readonly singleFlight = new SingleFlight<PaymentResult>()

  constructor(
    private readonly payments: PaymentRepository,
    private readonly provider: PaymentProvider,
    private readonly events: PaymentEventBus
  ) {}

  async execute(query: GetPaymentStatusQuery): Promise<PaymentResult> {
    return this.singleFlight.do(query.paymentId, async () => {
      const payment = await this.payments.findById(query.paymentId)
      if (!payment) {
        throw new PaymentNotFoundError(query.paymentId)
      }

      if (payment.needsProviderSync()) {
        const oldStatus = payment.status.value
        const status = await this.provider.fetchStatus(payment.providerTxId!)
        payment.syncStatus(status)

        if (payment.status.value !== oldStatus) {
          await this.payments.save(payment)
          try {
            await this.events.publishStatusChanged(payment)
          } catch (pubError) {
            // Event publishing failure should not crash status retrieval.
          }
        }
      }

      return { paymentId: payment.paymentId, status: payment.status.value }
    })
  }
}
