import { Payment } from '../../../domain/entities/payment.js'
import { Money } from '../../../domain/value-objects/money.js'
import { PaymentMethod } from '../../../domain/value-objects/payment-method.js'
import { PaymentStatus } from '../../../domain/value-objects/payment-status.js'

/**
 * Minimal structural view of a persisted payment. Decoupling from the Lucid
 * model keeps the mapper (and its tests) free of any database dependency — a
 * plain object satisfies it just as well as a model instance.
 */
export interface PaymentRecord {
  paymentId: string
  amount: number
  currency: string
  method: string
  status: string
  productId: string
  providerTxId: string | null
  webhookUrl: string | null
}

/** Attributes written to the `payments` table (timestamps are DB-managed). */
export type PaymentPersistenceAttributes = PaymentRecord

/** Translates between the Payment aggregate and its persisted representation. */
export class PaymentMapper {
  static toPersistence(payment: Payment): PaymentPersistenceAttributes {
    return {
      paymentId: payment.paymentId,
      amount: payment.money.amount,
      currency: payment.money.currency,
      method: payment.method.value,
      status: payment.status.value,
      productId: payment.productId,
      providerTxId: payment.providerTxId,
      webhookUrl: payment.webhookUrl,
    }
  }

  static toDomain(record: PaymentRecord): Payment {
    return Payment.restore({
      paymentId: record.paymentId,
      money: Money.create(record.amount, record.currency),
      method: PaymentMethod.fromString(record.method),
      productId: record.productId,
      status: PaymentStatus.fromString(record.status),
      providerTxId: record.providerTxId,
      webhookUrl: record.webhookUrl,
    })
  }
}
