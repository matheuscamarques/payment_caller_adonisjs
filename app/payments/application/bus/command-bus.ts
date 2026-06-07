/**
 * Marker base class for commands — the *write* side of CQRS. A command
 * expresses an intention to change state.
 *
 * `TResult` records what dispatching the command resolves to. It is carried at
 * the type level via a phantom field, letting the bus infer the result type at
 * the call site (no manual generic assertions).
 */
export abstract class Command<TResult = unknown> {
  declare readonly __result: TResult
}

/** Handles exactly one command type, producing a result. */
export interface CommandHandler<TCommand extends Command, TResult> {
  execute(command: TCommand): Promise<TResult>
}

export type CommandConstructor<TCommand extends Command = Command> = new (
  ...args: any[]
) => TCommand

/** Extracts the result type a command resolves to. */
export type CommandResult<TCommand extends Command> =
  TCommand extends Command<infer TResult> ? TResult : never

/**
 * Write-side dispatcher. Declared as an abstract class so it can be used as an
 * IoC-container token; the concrete bus is bound in the payments provider.
 */
export abstract class CommandBus {
  abstract register<TCommand extends Command, TResult>(
    command: CommandConstructor<TCommand>,
    handler: CommandHandler<TCommand, TResult>
  ): void

  abstract dispatch<TCommand extends Command>(command: TCommand): Promise<CommandResult<TCommand>>
}

/**
 * A minimal in-memory command bus mapping each command type to a single
 * handler. Keeping the command/query split explicit gives us one obvious seam
 * for future cross-cutting concerns (logging, transactions, retries) without
 * touching the handlers.
 */
export class InMemoryCommandBus extends CommandBus {
  readonly #handlers = new Map<CommandConstructor, CommandHandler<Command, unknown>>()

  register<TCommand extends Command, TResult>(
    command: CommandConstructor<TCommand>,
    handler: CommandHandler<TCommand, TResult>
  ): void {
    this.#handlers.set(command as CommandConstructor, handler as CommandHandler<Command, unknown>)
  }

  async dispatch<TCommand extends Command>(command: TCommand): Promise<CommandResult<TCommand>> {
    const handler = this.#handlers.get(command.constructor as CommandConstructor)
    if (!handler) {
      throw new Error(`No handler registered for command "${command.constructor.name}"`)
    }
    return handler.execute(command) as Promise<CommandResult<TCommand>>
  }
}
