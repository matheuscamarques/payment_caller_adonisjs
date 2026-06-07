import env from '#start/env'

/**
 * Configuration for the external (fictitious) payment provider.
 *
 * Values are read from the environment so the same build can target a real
 * provider, a sandbox, or a mocked endpoint during tests — without code changes.
 */
export interface ProviderConfig {
  /** Base URL of the external payment provider. */
  baseUrl: string
  /** Request timeout in milliseconds. */
  timeout: number
  /** Number of retries for transient failures. */
  retries: number
  /** Initial delay for exponential backoff retry in milliseconds. */
  retryDelay: number
  /** Number of consecutive failures to trip circuit breaker. */
  circuitFailures: number
  /** Circuit breaker open status cooldown in milliseconds. */
  circuitCooldown: number
}

const providerConfig: ProviderConfig = {
  baseUrl: env.get('PAYMENT_PROVIDER_URL', 'http://external.provider.com'),
  timeout: env.get('PAYMENT_PROVIDER_TIMEOUT', 5000),
  retries: env.get('PAYMENT_PROVIDER_RETRIES', 3),
  retryDelay: env.get('PAYMENT_PROVIDER_RETRY_DELAY', 100),
  circuitFailures: env.get('PAYMENT_PROVIDER_CIRCUIT_FAILURES', 3),
  circuitCooldown: env.get('PAYMENT_PROVIDER_CIRCUIT_COOLDOWN', 10000),
}

export default providerConfig
