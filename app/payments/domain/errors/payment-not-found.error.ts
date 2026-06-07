import { DomainError } from './domain-error.js'

/** Raised when a payment cannot be found by its business id. Maps to HTTP 404. */
export class PaymentNotFoundError extends DomainError {
  readonly code = 'E_PAYMENT_NOT_FOUND'

  constructor(paymentId: string) {
    super(`Payment "${paymentId}" was not found`)
  }
}
