import { DateTime } from 'luxon'
import { BaseModel, column } from '@adonisjs/lucid/orm'

/**
 * Lucid persistence model for the `payments` table — an infrastructure detail
 * the domain never references. CamelCase properties map to snake_case columns
 * through Lucid's default naming strategy.
 */
export default class PaymentModel extends BaseModel {
  static table = 'payments'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare paymentId: string

  @column()
  declare amount: number

  @column()
  declare currency: string

  @column()
  declare method: string

  @column()
  declare productId: string

  @column()
  declare status: string

  @column()
  declare providerTxId: string | null

  @column()
  declare webhookUrl: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime
}
