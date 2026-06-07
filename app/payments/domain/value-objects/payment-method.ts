import { InvalidPaymentMethodError } from '../errors/invalid-payment-data.error.js'

/**
 * Payment methods supported by our public API contract.
 *
 * NOTE: translating these into the external provider's vocabulary
 * (e.g. "PAYPAL" -> "pay-pal") is an anti-corruption concern handled by the
 * provider adapter — never here. The domain knows only its own vocabulary.
 */
export const PAYMENT_METHODS = ['PAYPAL', 'CREDIT_CARD', 'PIX'] as const

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]

export class PaymentMethod {
  private constructor(public readonly value: PaymentMethodValue) {}

  static fromString(value: string): PaymentMethod {
    if (!PAYMENT_METHODS.includes(value as PaymentMethodValue)) {
      throw new InvalidPaymentMethodError(value)
    }
    return new PaymentMethod(value as PaymentMethodValue)
  }

  equals(other: PaymentMethod): boolean {
    return this.value === other.value
  }

  toString(): string {
    return this.value
  }
}
