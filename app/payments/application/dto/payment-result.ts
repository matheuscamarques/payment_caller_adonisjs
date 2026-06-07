/**
 * The shape returned to API clients for both payment initiation and status
 * checks: `{ paymentId, status }`. This is the application's output contract,
 * decoupled from both the domain entity and the persistence model.
 */
export interface PaymentResult {
  paymentId: string
  status: string
}
