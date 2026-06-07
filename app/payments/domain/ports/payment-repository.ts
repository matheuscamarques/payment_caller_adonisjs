import { Payment } from '../entities/payment.js'

/**
 * Driven port: the persistence boundary for the Payment aggregate.
 *
 * Declared as an abstract class (not a TS interface) on purpose: interfaces are
 * erased at compile time and cannot be used as IoC-container tokens, whereas an
 * abstract class survives as a runtime value and doubles as both contract and
 * injection token.
 */
export abstract class PaymentRepository {
  /** Persist a payment, inserting or updating by its business id. */
  abstract save(payment: Payment): Promise<void>

  /** Load a payment by its business id, or `null` when it does not exist. */
  abstract findById(paymentId: string): Promise<Payment | null>
}
