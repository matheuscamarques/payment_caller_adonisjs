import { DomainError } from './domain-error.js'

/**
 * Raised when the external provider cannot be reached or responds with an
 * unexpected/error status. Maps to HTTP 502 at the edge.
 */
export class ProviderUnavailableError extends DomainError {
  readonly code = 'E_PROVIDER_UNAVAILABLE'

  constructor(
    message: string = 'The payment provider is currently unavailable',
    readonly reason?: unknown
  ) {
    super(message)
  }
}
