import { test } from '@japa/runner'
import { Query, QueryHandler, InMemoryQueryBus } from '#payments/application/bus/query-bus'

class EchoQuery extends Query<string> {
  constructor(readonly value: string) {
    super()
  }
}

class EchoHandler implements QueryHandler<EchoQuery, string> {
  async execute(query: EchoQuery): Promise<string> {
    return query.value.toUpperCase()
  }
}

class UnregisteredQuery extends Query {}

test.group('InMemoryQueryBus', () => {
  test('routes a query to its registered handler', async ({ assert }) => {
    const bus = new InMemoryQueryBus()
    bus.register(EchoQuery, new EchoHandler())

    const result = await bus.ask(new EchoQuery('hello'))

    assert.equal(result, 'HELLO')
  })

  test('throws when no handler is registered for the query', async ({ assert }) => {
    const bus = new InMemoryQueryBus()

    let raised: unknown
    try {
      await bus.ask(new UnregisteredQuery())
    } catch (error) {
      raised = error
    }

    assert.instanceOf(raised, Error)
    assert.include((raised as Error).message, 'UnregisteredQuery')
  })
})
