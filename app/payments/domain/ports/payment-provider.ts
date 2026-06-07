import { Payment } from '../entities/payment.js'
import { PaymentStatusValue } from '../value-objects/payment-status.js'

/**
 * Outcome of initiating a payment against the external provider, already
 * translated into our domain vocabulary by the adapter.
 */
export interface ProviderInitiation {
  /** The provider's transaction id (its `tx_id`). */
  providerTxId: string
  /** The provider's reported status, mapped to our domain status. */
  status: PaymentStatusValue
}

/**
 * Driven port: the boundary to the external payment provider.
 *
 * Adapters own the anti-corruption translation between our domain and the
 * provider's wire contract — the core only ever sees domain types, never the
 * provider's DTOs. Declared as an abstract class so it can serve as a DI token
 * (see PaymentRepository for the rationale).
 */
export abstract class PaymentProvider {
  /**
   * Initiate a payment with the provider.
   * @throws ProviderUnavailableError on any transport/protocol failure.
   */
  abstract initiate(payment: Payment): Promise<ProviderInitiation>

  /**
   * Fetch the current status for a provider transaction id.
   * @throws ProviderUnavailableError on any transport/protocol failure.
   */
  abstract fetchStatus(providerTxId: string): Promise<PaymentStatusValue>
}
