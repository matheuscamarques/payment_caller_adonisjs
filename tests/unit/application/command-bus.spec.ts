import { test } from '@japa/runner'
import { Command, CommandHandler, InMemoryCommandBus } from '#payments/application/bus/command-bus'

class DoubleCommand extends Command<number> {
  constructor(readonly value: number) {
    super()
  }
}

class DoubleHandler implements CommandHandler<DoubleCommand, number> {
  async execute(command: DoubleCommand): Promise<number> {
    return command.value * 2
  }
}

class UnregisteredCommand extends Command {}

test.group('InMemoryCommandBus', () => {
  test('dispatches a command to its registered handler', async ({ assert }) => {
    const bus = new InMemoryCommandBus()
    bus.register(DoubleCommand, new DoubleHandler())

    const result = await bus.dispatch(new DoubleCommand(21))

    assert.equal(result, 42)
  })

  test('throws when no handler is registered for the command', async ({ assert }) => {
    const bus = new InMemoryCommandBus()

    let raised: unknown
    try {
      await bus.dispatch(new UnregisteredCommand())
    } catch (error) {
      raised = error
    }

    assert.instanceOf(raised, Error)
    assert.include((raised as Error).message, 'UnregisteredCommand')
  })
})
