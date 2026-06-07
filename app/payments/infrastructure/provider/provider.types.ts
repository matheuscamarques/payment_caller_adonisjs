/**
 * The external provider's wire contract (its DTOs). These shapes exist only at
 * the boundary and never leak into the domain — the ProviderMapper translates
 * them to/from our domain types.
 */

export interface ProviderMoney {
  amount: number
  currency: string
}

/** Request body for `POST /init-payment`. */
export interface InitPaymentRequest {
  money: ProviderMoney
  payment_method: string
  product_id: string
}

/** Response body for both `POST /init-payment` and `GET /list-payment/:id`. */
export interface ProviderPaymentResponse {
  tx_id: string
  status: string
}
