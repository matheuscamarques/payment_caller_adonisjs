/**
 * Base class for all domain errors.
 *
 * Domain errors are framework-agnostic: they carry a stable, machine-readable
 * `code` and a human message. Translating them into transport-level responses
 * (HTTP status codes) is the responsibility of the edge (the exception handler),
 * keeping the core decoupled from the delivery mechanism.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string

  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}
