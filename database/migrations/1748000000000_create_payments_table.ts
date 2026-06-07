import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'payments'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').notNullable()

      /**
       * Business identifier exposed to API clients (our "paymentId").
       * Decoupled from the provider's "tx_id", which lives in provider_tx_id.
       */
      table.uuid('payment_id').notNullable().unique()

      /**
       * Amount is stored in the currency's minor unit (e.g. cents) as an
       * integer to avoid floating-point rounding issues with money.
       */
      table.integer('amount').notNullable()
      table.string('currency', 3).notNullable()
      table.string('method').notNullable()
      table.uuid('product_id').notNullable()
      table.string('status').notNullable()

      /**
       * The transaction id returned by the external provider. Null until the
       * provider has accepted the payment (or if it never did).
       */
      table.string('provider_tx_id').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').notNullable()
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
