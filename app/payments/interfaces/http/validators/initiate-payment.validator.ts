import vine from '@vinejs/vine'
import { PAYMENT_METHODS } from '#payments/domain/value-objects/payment-method'

/**
 * Validates the `POST /api/v1/payments` request body. Field names mirror the
 * public API contract (note the snake_case `product_id`).
 *
 * `amount` is an integer in the currency's minor unit (e.g. cents).
 */
export const initiatePaymentValidator = vine.compile(
  vine.object({
    amount: vine.number().positive().withoutDecimals(),
    currency: vine
      .string()
      .trim()
      .regex(/^[A-Za-z]{3}$/),
    method: vine.enum(PAYMENT_METHODS),
    product_id: vine.string().trim().uuid(),
  })
)
