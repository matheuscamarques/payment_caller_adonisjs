/**
 * Marker base class for queries — the *read* side of CQRS. A query asks for
 * data and must never change state.
 *
 * `TResult` records what asking the query resolves to (carried at the type
 * level via a phantom field), so the bus can infer it at the call site.
 */
export abstract class Query<TResult = unknown> {
  declare readonly __result: TResult
}

/** Handles exactly one query type, producing a result. */
export interface QueryHandler<TQuery extends Query, TResult> {
  execute(query: TQuery): Promise<TResult>
}

export type QueryConstructor<TQuery extends Query = Query> = new (...args: any[]) => TQuery

/** Extracts the result type a query resolves to. */
export type QueryResult<TQuery extends Query> =
  TQuery extends Query<infer TResult> ? TResult : never

/**
 * Read-side dispatcher. Declared as an abstract class so it can be used as an
 * IoC-container token; the concrete bus is bound in the payments provider.
 */
export abstract class QueryBus {
  abstract register<TQuery extends Query, TResult>(
    query: QueryConstructor<TQuery>,
    handler: QueryHandler<TQuery, TResult>
  ): void

  abstract ask<TQuery extends Query>(query: TQuery): Promise<QueryResult<TQuery>>
}

/** A minimal in-memory query bus mapping each query type to a single handler. */
export class InMemoryQueryBus extends QueryBus {
  readonly #handlers = new Map<QueryConstructor, QueryHandler<Query, unknown>>()

  register<TQuery extends Query, TResult>(
    query: QueryConstructor<TQuery>,
    handler: QueryHandler<TQuery, TResult>
  ): void {
    this.#handlers.set(query as QueryConstructor, handler as QueryHandler<Query, unknown>)
  }

  async ask<TQuery extends Query>(query: TQuery): Promise<QueryResult<TQuery>> {
    const handler = this.#handlers.get(query.constructor as QueryConstructor)
    if (!handler) {
      throw new Error(`No handler registered for query "${query.constructor.name}"`)
    }
    return handler.execute(query) as Promise<QueryResult<TQuery>>
  }
}
