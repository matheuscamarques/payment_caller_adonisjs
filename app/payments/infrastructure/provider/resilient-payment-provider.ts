import { Payment } from '../../domain/entities/payment.js'
import { PaymentProvider, ProviderInitiation } from '../../domain/ports/payment-provider.js'
import { PaymentStatusValue } from '../../domain/value-objects/payment-status.js'
import { ProviderUnavailableError } from '../../domain/errors/provider-unavailable.error.js'

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN'

/**
 * Decorator implementation of the PaymentProvider port that adds fault-tolerance
 * behaviors: exponential backoff retries and a circuit breaker.
 *
 * Designed to wrap a raw transport adapter (like HttpPaymentProvider) and protect the system
 * against cascading failures or overload from temporary outages.
 */
export class ResilientPaymentProvider extends PaymentProvider {
  private state: CircuitState = 'CLOSED'
  private consecutiveFailures = 0
  private lastStateChange: number = Date.now()

  constructor(
    private readonly next: PaymentProvider,
    private readonly maxRetries = 3,
    private readonly initialDelayMs = 100,
    private readonly backoffFactor = 2,
    private readonly failureThreshold = 3,
    private readonly cooldownMs = 10000
  ) {
    super()
  }

  /** Gets the current state of the circuit breaker (mainly for testing/debugging). */
  getCircuitState(): CircuitState {
    this.updateState()
    return this.state
  }

  /** Forces updating state based on cooldown. */
  private updateState() {
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastStateChange
      if (elapsed >= this.cooldownMs) {
        this.state = 'HALF_OPEN'
        this.lastStateChange = Date.now()
      }
    }
  }

  private recordSuccess() {
    this.consecutiveFailures = 0
    this.state = 'CLOSED'
    this.lastStateChange = Date.now()
  }

  private recordFailure() {
    this.consecutiveFailures++
    if (this.state === 'HALF_OPEN' || this.consecutiveFailures >= this.failureThreshold) {
      this.state = 'OPEN'
      this.lastStateChange = Date.now()
    }
  }

  private async executeWithResilience<T>(actionName: string, fn: () => Promise<T>): Promise<T> {
    this.updateState()

    if (this.state === 'OPEN') {
      throw new ProviderUnavailableError(
        `Circuit breaker is OPEN for ${actionName}. Request blocked (fail-fast).`
      )
    }

    try {
      const result = await this.retry(fn)
      this.recordSuccess()
      return result
    } catch (error) {
      this.recordFailure()
      throw error
    }
  }

  private async retry<T>(fn: () => Promise<T>): Promise<T> {
    let attempt = 0
    let delay = this.initialDelayMs

    while (true) {
      try {
        return await fn()
      } catch (error) {
        attempt++
        if (attempt > this.maxRetries) {
          throw error
        }
        await new Promise((resolve) => setTimeout(resolve, delay))
        delay *= this.backoffFactor
      }
    }
  }

  async initiate(payment: Payment): Promise<ProviderInitiation> {
    return this.executeWithResilience('initiate', () => this.next.initiate(payment))
  }

  async fetchStatus(providerTxId: string): Promise<PaymentStatusValue> {
    return this.executeWithResilience('fetchStatus', () => this.next.fetchStatus(providerTxId))
  }
}
