import { Query } from '../../bus/query-bus.js'
import { PaymentResult } from '../../dto/payment-result.js'

/** Read intention: fetch the current status of a payment by its business id. */
export class GetPaymentStatusQuery extends Query<PaymentResult> {
  constructor(readonly paymentId: string) {
    super()
  }
}
