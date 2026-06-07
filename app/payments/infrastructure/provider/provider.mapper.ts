import { Payment } from '../../domain/entities/payment.js'
import { PaymentMethodValue } from '../../domain/value-objects/payment-method.js'
import { PaymentStatusValue } from '../../domain/value-objects/payment-status.js'
import { ProviderInitiation } from '../../domain/ports/payment-provider.js'
import { ProviderUnavailableError } from '../../domain/errors/provider-unavailable.error.js'
import { InitPaymentRequest, ProviderPaymentResponse } from './provider.types.js'

/**
 * Anti-corruption layer between our domain and the external provider's wire
 * contract. This is the ONLY place that knows the provider's vocabulary:
 *
 *   - our flat { amount, currency }  ->  provider's nested { money: { ... } }
 *   - our method "PAYPAL"            ->  provider's "pay-pal"
 *   - provider's "tx_id" / "status"  ->  our domain types
 */

/**
 * Explicit method translation table. Keyed by every PaymentMethodValue, so
 * adding a method to the domain enum without mapping it here is a compile error
 * (Open/Closed: extension is localised to this table).
 */
const METHOD_TO_PROVIDER: Record<PaymentMethodValue, string> = {
  PAYPAL: 'pay-pal',
  CREDIT_CARD: 'credit-card',
  PIX: 'pix',
}

/** Translation of the provider's status vocabulary into our own. */
const PROVIDER_STATUS_TO_DOMAIN: Record<string, PaymentStatusValue> = {
  pending: 'pending',
  processing: 'pending',
  in_progress: 'pending',
  processed: 'processed',
  succeeded: 'processed',
  failed: 'failed',
  declined: 'failed',
  canceled: 'failed',
}

export class ProviderMapper {
  /** Build the provider request body from our domain aggregate. */
  static toInitRequest(payment: Payment): InitPaymentRequest {
    return {
      money: {
        amount: payment.money.amount,
        currency: payment.money.currency,
      },
      payment_method: this.toProviderMethod(payment.method.value),
      product_id: payment.productId,
    }
  }

  static toProviderMethod(method: PaymentMethodValue): string {
    return METHOD_TO_PROVIDER[method]
  }

  /** Map a provider status string into our domain status, defensively. */
  static toDomainStatus(providerStatus: string): PaymentStatusValue {
    const normalized = typeof providerStatus === 'string' ? providerStatus.toLowerCase() : ''
    const mapped = PROVIDER_STATUS_TO_DOMAIN[normalized]
    if (!mapped) {
      throw new ProviderUnavailableError(
        `Provider returned an unrecognised status: "${providerStatus}"`
      )
    }
    return mapped
  }

  /** Translate a full provider response into a domain-level initiation result. */
  static toInitiation(response: ProviderPaymentResponse): ProviderInitiation {
    return {
      providerTxId: response.tx_id,
      status: this.toDomainStatus(response.status),
    }
  }
}
