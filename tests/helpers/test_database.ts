import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql'

let container: StartedPostgreSqlContainer | undefined

/** Suites that require a real database (and therefore a Postgres container). */
const DB_SUITES = ['integration', 'functional']
const KNOWN_SUITES = ['unit', ...DB_SUITES]

/**
 * Decide whether the current test run needs a database. Suite names are passed
 * positionally to `bin/test.ts` (e.g. `node ace test unit`). When no suite is
 * named, every suite runs and we err on the safe side by booting the database.
 * Unit-only runs need neither Docker nor a database.
 */
export function databaseRequired(): boolean {
  const requested = process.argv.slice(2).filter((arg) => KNOWN_SUITES.includes(arg))
  return requested.length === 0 || requested.some((suite) => DB_SUITES.includes(suite))
}

/**
 * Boot an ephemeral PostgreSQL container (Testcontainers) and point the app's
 * DB_* environment variables at it.
 *
 * This MUST run before `#start/env` is imported: Adonis caches env values at
 * import time, and `process.env` takes precedence over the `.env` file — so by
 * setting these first, the Lucid config transparently targets the container.
 */
export async function startTestDatabase(): Promise<void> {
  if (container) {
    return
  }

  container = await new PostgreSqlContainer('postgres:16-alpine').start()

  process.env.DB_HOST = container.getHost()
  process.env.DB_PORT = String(container.getPort())
  process.env.DB_USER = container.getUsername()
  process.env.DB_PASSWORD = container.getPassword()
  process.env.DB_DATABASE = container.getDatabase()
}

/** Stop and remove the container (no-op if it was never started). */
export async function stopTestDatabase(): Promise<void> {
  if (container) {
    await container.stop()
    container = undefined
  }
}
