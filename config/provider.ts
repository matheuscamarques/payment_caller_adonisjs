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
}

const providerConfig: ProviderConfig = {
  baseUrl: env.get('PAYMENT_PROVIDER_URL', 'http://external.provider.com'),
  timeout: env.get('PAYMENT_PROVIDER_TIMEOUT', 5000),
}

export default providerConfig
