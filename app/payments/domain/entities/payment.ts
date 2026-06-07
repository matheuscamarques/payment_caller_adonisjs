import { randomUUID } from 'node:crypto'
import { Money } from '../value-objects/money.js'
import { PaymentMethod } from '../value-objects/payment-method.js'
import { PaymentStatus, PaymentStatusValue } from '../value-objects/payment-status.js'

interface InitiateProps {
  money: Money
  method: PaymentMethod
  productId: string
}

interface RestoreProps {
  paymentId: string
  money: Money
  method: PaymentMethod
  productId: string
  status: PaymentStatus
  providerTxId: string | null
}

/**
 * Payment aggregate root.
 *
 * Encapsulates the lifecycle rules of a payment and exposes only
 * intent-revealing behaviour. It is intentionally free of any framework or
 * persistence concern — repositories map it to/from their storage shape.
 */
export class Payment {
  private constructor(
    public readonly paymentId: string,
    public readonly money: Money,
    public readonly method: PaymentMethod,
    public readonly productId: string,
    private currentStatus: PaymentStatus,
    private currentProviderTxId: string | null
  ) {}

  /**
   * Create a brand new payment. It always starts as `pending`: even though the
   * provider may respond synchronously, our API reports `pending` at creation
   * and only reflects the real state once the status endpoint syncs it.
   */
  static initiate(props: InitiateProps): Payment {
    return new Payment(
      randomUUID(),
      props.money,
      props.method,
      props.productId,
      PaymentStatus.pending(),
      null
    )
  }

  /** Rebuild an aggregate from persisted state (used by repositories). */
  static restore(props: RestoreProps): Payment {
    return new Payment(
      props.paymentId,
      props.money,
      props.method,
      props.productId,
      props.status,
      props.providerTxId
    )
  }

  get status(): PaymentStatus {
    return this.currentStatus
  }

  get providerTxId(): string | null {
    return this.currentProviderTxId
  }

  /** Record the provider's transaction id once it accepted the initiation. */
  linkToProvider(providerTxId: string): void {
    this.currentProviderTxId = providerTxId
  }

  /** Reconcile our status with the one reported by the provider. */
  syncStatus(status: PaymentStatusValue): void {
    this.currentStatus = PaymentStatus.fromString(status)
  }

  /** Mark the payment as failed (e.g. the provider was unreachable on init). */
  markAsFailed(): void {
    this.currentStatus = PaymentStatus.failed()
  }

  /** Whether a live status refresh against the provider is warranted. */
  needsProviderSync(): boolean {
    return this.currentProviderTxId !== null && !this.currentStatus.isFinal()
  }
}
