import { CommandHandler } from '../../bus/command-bus.js'
import { PaymentResult } from '../../dto/payment-result.js'
import { Payment } from '../../../domain/entities/payment.js'
import { Money } from '../../../domain/value-objects/money.js'
import { PaymentMethod } from '../../../domain/value-objects/payment-method.js'
import { PaymentRepository } from '../../../domain/ports/payment-repository.js'
import { PaymentProvider } from '../../../domain/ports/payment-provider.js'
import { ProviderUnavailableError } from '../../../domain/errors/provider-unavailable.error.js'
import { InitiatePaymentCommand } from './initiate-payment.command.js'

/**
 * Use case: initiate a payment (pending-first + fail-fast).
 *
 *   1. Build the aggregate (validating money/method) and persist it as `pending`.
 *   2. Call the provider synchronously:
 *      - success → store the provider tx id; status stays `pending` (the status
 *        endpoint is the single place that reconciles the real state).
 *      - failure → mark the payment `failed`, persist, and surface a
 *        ProviderUnavailableError (translated to HTTP 502 at the edge).
 */
export class InitiatePaymentHandler
  implements CommandHandler<InitiatePaymentCommand, PaymentResult>
{
  constructor(
    private readonly payments: PaymentRepository,
    private readonly provider: PaymentProvider
  ) {}

  async execute(command: InitiatePaymentCommand): Promise<PaymentResult> {
    const payment = Payment.initiate({
      money: Money.create(command.amount, command.currency),
      method: PaymentMethod.fromString(command.method),
      productId: command.productId,
    })

    await this.payments.save(payment)

    try {
      const initiation = await this.provider.initiate(payment)
      payment.linkToProvider(initiation.providerTxId)
      await this.payments.save(payment)
    } catch (error) {
      payment.markAsFailed()
      await this.payments.save(payment)

      if (error instanceof ProviderUnavailableError) {
        throw error
      }
      throw new ProviderUnavailableError('Failed to initiate payment with the provider', error)
    }

    return { paymentId: payment.paymentId, status: payment.status.value }
  }
}
