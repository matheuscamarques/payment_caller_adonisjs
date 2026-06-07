import app from '@adonisjs/core/services/app'
import { HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import { DomainError } from '#payments/domain/errors/domain-error'
import { PaymentNotFoundError } from '#payments/domain/errors/payment-not-found.error'
import { ProviderUnavailableError } from '#payments/domain/errors/provider-unavailable.error'
import { InvalidPaymentDataError } from '#payments/domain/errors/invalid-payment-data.error'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. You might want to enable them in production only, but feel
   * free to enable them in development as well.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Translate framework-agnostic domain errors into transport-level responses.
   * Anything not handled here falls back to AdonisJS' default handling (which
   * already maps VineJS validation errors to HTTP 422).
   */
  async handle(error: unknown, ctx: HttpContext) {
    if (error instanceof PaymentNotFoundError) {
      return ctx.response.status(404).send({ code: error.code, message: error.message })
    }

    if (error instanceof ProviderUnavailableError) {
      return ctx.response.status(502).send({ code: error.code, message: error.message })
    }

    if (error instanceof InvalidPaymentDataError) {
      return ctx.response.status(422).send({ code: error.code, message: error.message })
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    // Domain errors are expected, fully-handled outcomes (404/422/502) already
    // translated to responses in `handle()` — not bugs. Skip the noisy error
    // reporting for them (a real system would route provider failures to
    // monitoring instead).
    if (error instanceof DomainError) {
      return
    }
    return super.report(error, ctx)
  }
}
