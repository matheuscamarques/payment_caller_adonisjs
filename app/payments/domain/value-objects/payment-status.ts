import { InvalidPaymentStatusError } from '../errors/invalid-payment-data.error.js'

/**
 * The lifecycle of a payment as exposed by our API:
 *
 * - `pending`   : created on our side; the provider has not (yet) reported a final state.
 * - `processed` : the provider confirmed the payment was processed.
 * - `failed`    : the provider rejected it, or was unreachable during initiation.
 */
export const PAYMENT_STATUSES = ['pending', 'processed', 'failed'] as const

export type PaymentStatusValue = (typeof PAYMENT_STATUSES)[number]

export class PaymentStatus {
  private constructor(public readonly value: PaymentStatusValue) {}

  static pending(): PaymentStatus {
    return new PaymentStatus('pending')
  }

  static failed(): PaymentStatus {
    return new PaymentStatus('failed')
  }

  static fromString(value: string): PaymentStatus {
    if (!PAYMENT_STATUSES.includes(value as PaymentStatusValue)) {
      throw new InvalidPaymentStatusError(value)
    }
    return new PaymentStatus(value as PaymentStatusValue)
  }

  /** Terminal states no longer change and need no re-sync with the provider. */
  isFinal(): boolean {
    return this.value === 'processed' || this.value === 'failed'
  }

  isPending(): boolean {
    return this.value === 'pending'
  }

  equals(other: PaymentStatus): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
