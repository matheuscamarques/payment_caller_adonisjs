import { InvalidMoneyError } from '../errors/invalid-payment-data.error.js'

/**
 * Money value object.
 *
 * The amount is always expressed in the currency's minor unit (e.g. cents) as a
 * non-negative integer — never a float — to avoid rounding issues. The currency
 * is an ISO-4217 alpha-3 code. Instances are immutable and compared by value.
 */
export class Money {
  private constructor(
    public readonly amount: number,
    public readonly currency: string
  ) {}

  static create(amount: number, currency: string): Money {
    // A payment must move a positive amount: zero-value charges are rejected,
    // matching the HTTP validator (kept consistent across both layers).
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new InvalidMoneyError(
        `Amount must be a positive integer in minor units, received: ${amount}`
      )
    }

    const normalized = typeof currency === 'string' ? currency.toUpperCase() : ''
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new InvalidMoneyError(
        `Currency must be an ISO-4217 alpha-3 code, received: "${currency}"`
      )
    }

    return new Money(amount, normalized)
  }

  equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency
  }
}
