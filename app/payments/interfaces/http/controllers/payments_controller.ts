import { inject } from '@adonisjs/core'
import { HttpContext } from '@adonisjs/core/http'
import { CommandBus } from '#payments/application/bus/command-bus'
import { QueryBus } from '#payments/application/bus/query-bus'
import { InitiatePaymentCommand } from '#payments/application/commands/initiate-payment/initiate-payment.command'
import { GetPaymentStatusQuery } from '#payments/application/queries/get-payment-status/get-payment-status.query'
import { initiatePaymentValidator } from '#payments/interfaces/http/validators/initiate-payment.validator'

/**
 * HTTP driving adapter. It only translates HTTP <-> command/query and holds no
 * business logic — that lives in the handlers, reached through the CQRS buses.
 */
@inject()
export default class PaymentsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  /** POST /api/v1/payments — initiate a payment. */
  async store({ request, response }: HttpContext) {
    const payload = await request.validateUsing(initiatePaymentValidator)

    const result = await this.commandBus.dispatch(
      new InitiatePaymentCommand(
        payload.amount,
        payload.currency,
        payload.method,
        payload.product_id
      )
    )

    return response.created(result)
  }

  /** GET /api/v1/payments/:paymentId — check a payment's status. */
  async show({ params, response }: HttpContext) {
    const result = await this.queryBus.ask(new GetPaymentStatusQuery(params.paymentId))

    return response.ok(result)
  }
}
