import type { ApplicationService } from '@adonisjs/core/types'
import axios from 'axios'
import { PaymentRepository } from '#payments/domain/ports/payment-repository'
import { PaymentProvider } from '#payments/domain/ports/payment-provider'
import { LucidPaymentRepository } from '#payments/infrastructure/persistence/lucid-payment.repository'
import { HttpPaymentProvider } from '#payments/infrastructure/provider/http-payment-provider'
import { CommandBus, InMemoryCommandBus } from '#payments/application/bus/command-bus'
import { QueryBus, InMemoryQueryBus } from '#payments/application/bus/query-bus'
import { InitiatePaymentCommand } from '#payments/application/commands/initiate-payment/initiate-payment.command'
import { InitiatePaymentHandler } from '#payments/application/commands/initiate-payment/initiate-payment.handler'
import { GetPaymentStatusQuery } from '#payments/application/queries/get-payment-status/get-payment-status.query'
import { GetPaymentStatusHandler } from '#payments/application/queries/get-payment-status/get-payment-status.handler'

/**
 * Composition root of the payments hexagon.
 *
 * This is the single place where concrete implementations are chosen: it binds
 * the driven ports to their adapters and registers the CQRS handlers on the
 * buses. Every other module depends only on abstractions (DIP) — swapping an
 * adapter (e.g. a different provider or datastore) is a change confined here.
 */
export default class PaymentsProvider {
  constructor(protected app: ApplicationService) {}

  register() {
    // --- Driven ports -> adapters ------------------------------------------
    this.app.container.singleton(PaymentRepository, async () => {
      return new LucidPaymentRepository()
    })

    this.app.container.singleton(PaymentProvider, async () => {
      const config = (await import('#config/provider')).default
      const http = axios.create({ baseURL: config.baseUrl, timeout: config.timeout })
      return new HttpPaymentProvider(http)
    })

    // --- Write side (CQRS) -------------------------------------------------
    this.app.container.singleton(CommandBus, async (resolver) => {
      const payments = await resolver.make(PaymentRepository)
      const provider = await resolver.make(PaymentProvider)

      const bus = new InMemoryCommandBus()
      bus.register(InitiatePaymentCommand, new InitiatePaymentHandler(payments, provider))
      return bus
    })

    // --- Read side (CQRS) --------------------------------------------------
    this.app.container.singleton(QueryBus, async (resolver) => {
      const payments = await resolver.make(PaymentRepository)
      const provider = await resolver.make(PaymentProvider)

      const bus = new InMemoryQueryBus()
      bus.register(GetPaymentStatusQuery, new GetPaymentStatusHandler(payments, provider))
      return bus
    })
  }
}
