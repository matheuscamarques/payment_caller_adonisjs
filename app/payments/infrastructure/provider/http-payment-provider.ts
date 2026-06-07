import type { AxiosInstance } from 'axios'
import { isAxiosError } from 'axios'
import { Payment } from '../../domain/entities/payment.js'
import { PaymentProvider, ProviderInitiation } from '../../domain/ports/payment-provider.js'
import { PaymentStatusValue } from '../../domain/value-objects/payment-status.js'
import { ProviderUnavailableError } from '../../domain/errors/provider-unavailable.error.js'
import { ProviderMapper } from './provider.mapper.js'
import { ProviderPaymentResponse } from './provider.types.js'

/**
 * HTTP adapter for the external payment provider (a driven adapter).
 *
 * It owns only the transport concern (HTTP via axios) and converts any
 * transport/protocol failure into a ProviderUnavailableError. All contract
 * translation is delegated to ProviderMapper.
 */
export class HttpPaymentProvider extends PaymentProvider {
  constructor(private readonly http: AxiosInstance) {
    super()
  }

  async initiate(payment: Payment): Promise<ProviderInitiation> {
    try {
      const { data } = await this.http.post<ProviderPaymentResponse>(
        '/init-payment',
        ProviderMapper.toInitRequest(payment)
      )
      return ProviderMapper.toInitiation(data)
    } catch (error) {
      throw this.toDomainError(error, 'initiate payment')
    }
  }

  async fetchStatus(providerTxId: string): Promise<PaymentStatusValue> {
    try {
      const { data } = await this.http.get<ProviderPaymentResponse>(
        `/list-payment/${encodeURIComponent(providerTxId)}`
      )
      return ProviderMapper.toDomainStatus(data.status)
    } catch (error) {
      throw this.toDomainError(error, 'fetch payment status')
    }
  }

  private toDomainError(error: unknown, action: string): ProviderUnavailableError {
    // A mapping error we raised ourselves should bubble up unchanged.
    if (error instanceof ProviderUnavailableError) {
      return error
    }

    if (isAxiosError(error)) {
      const status = error.response?.status
      const detail = status ? `responded with HTTP ${status}` : 'could not be reached'
      return new ProviderUnavailableError(`Provider ${detail} while trying to ${action}`, error)
    }

    return new ProviderUnavailableError(`Unexpected error while trying to ${action}`, error)
  }
}
