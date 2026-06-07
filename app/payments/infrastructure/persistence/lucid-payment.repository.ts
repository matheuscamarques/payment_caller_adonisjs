import { Payment } from '../../domain/entities/payment.js'
import { PaymentRepository } from '../../domain/ports/payment-repository.js'
import PaymentModel from './models/payment_model.js'
import { PaymentMapper } from './mappers/payment.mapper.js'

/**
 * Lucid-backed implementation of the PaymentRepository port (a driven adapter).
 * It is the only place that touches the database for payments; everything above
 * depends on the port, not on Lucid.
 */
export class LucidPaymentRepository extends PaymentRepository {
  async save(payment: Payment): Promise<void> {
    const attributes = PaymentMapper.toPersistence(payment)
    // Upsert by business id so the same aggregate can be persisted repeatedly
    // (insert as `pending`, then update once the provider tx id / status change).
    await PaymentModel.updateOrCreate({ paymentId: payment.paymentId }, attributes)
  }

  async findById(paymentId: string): Promise<Payment | null> {
    const model = await PaymentModel.findBy('paymentId', paymentId)
    return model ? PaymentMapper.toDomain(model) : null
  }
}
