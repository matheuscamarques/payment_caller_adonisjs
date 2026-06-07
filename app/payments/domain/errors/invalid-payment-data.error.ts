import { DomainError } from './domain-error.js'

/**
 * Base for errors caused by invalid payment input reaching the domain. They
 * represent client mistakes and map to HTTP 422 at the edge. In practice the
 * HTTP validator (VineJS) catches these first; the domain checks are defence in
 * depth so the core stays correct even when invoked directly (e.g. in tests).
 */
export abstract class InvalidPaymentDataError extends DomainError {}

/** Raised when a Money value object is built from invalid data. */
export class InvalidMoneyError extends InvalidPaymentDataError {
  readonly code = 'E_INVALID_MONEY'
}

/** Raised when a payment method outside our supported set is provided. */
export class InvalidPaymentMethodError extends InvalidPaymentDataError {
  readonly code = 'E_INVALID_PAYMENT_METHOD'

  constructor(value: string) {
    super(`Unsupported payment method: "${value}"`)
  }
}

/** Raised when a payment status outside our supported set is provided. */
export class InvalidPaymentStatusError extends InvalidPaymentDataError {
  readonly code = 'E_INVALID_PAYMENT_STATUS'

  constructor(value: string) {
    super(`Unsupported payment status: "${value}"`)
  }
}
