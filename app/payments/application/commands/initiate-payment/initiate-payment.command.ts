import { Command } from '../../bus/command-bus.js'
import { PaymentResult } from '../../dto/payment-result.js'

/**
 * Write intention: start a new payment for a product.
 *
 * Carries primitives (not domain objects): it is the boundary DTO between the
 * HTTP edge and the application core. The handler builds the domain value
 * objects, so validation rules live in one place (the domain).
 */
export class InitiatePaymentCommand extends Command<PaymentResult> {
  constructor(
    readonly amount: number,
    readonly currency: string,
    readonly method: string,
    readonly productId: string,
    readonly webhookUrl?: string | null
  ) {
    super()
  }
}
