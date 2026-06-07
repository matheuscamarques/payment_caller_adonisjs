import { Payment } from '#payments/domain/entities/payment'
import { PaymentRepository } from '#payments/domain/ports/payment-repository'
import { PaymentProvider, ProviderInitiation } from '#payments/domain/ports/payment-provider'
import { PaymentStatusValue } from '#payments/domain/value-objects/payment-status'

/**
 * In-memory PaymentRepository — a test double letting us exercise the use cases
 * with no database, keeping unit tests fast and Docker-free.
 */
export class InMemoryPaymentRepository extends PaymentRepository {
  readonly store = new Map<string, Payment>()
  saveCalls = 0

  async save(payment: Payment): Promise<void> {
    this.saveCalls += 1
    this.store.set(payment.paymentId, payment)
  }

  async findById(paymentId: string): Promise<Payment | null> {
    return this.store.get(paymentId) ?? null
  }
}

interface FakeProviderBehaviour {
  initiation?: ProviderInitiation
  initiateError?: Error
  status?: PaymentStatusValue
  fetchError?: Error
}

/**
 * Configurable fake PaymentProvider — lets each test pin the provider's
 * behaviour (a result or a thrown error) and inspect how it was called.
 */
export class FakePaymentProvider extends PaymentProvider {
  readonly initiateCalls: Payment[] = []
  readonly fetchStatusCalls: string[] = []

  constructor(private readonly behaviour: FakeProviderBehaviour = {}) {
    super()
  }

  async initiate(payment: Payment): Promise<ProviderInitiation> {
    this.initiateCalls.push(payment)
    if (this.behaviour.initiateError) {
      throw this.behaviour.initiateError
    }
    return this.behaviour.initiation ?? { providerTxId: 'tx_default', status: 'processed' }
  }

  async fetchStatus(providerTxId: string): Promise<PaymentStatusValue> {
    this.fetchStatusCalls.push(providerTxId)
    if (this.behaviour.fetchError) {
      throw this.behaviour.fetchError
    }
    return this.behaviour.status ?? 'processed'
  }
}
