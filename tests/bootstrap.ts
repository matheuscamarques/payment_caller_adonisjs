import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import app from '@adonisjs/core/services/app'
import type { Config } from '@japa/runner/types'
import { pluginAdonisJS } from '@japa/plugin-adonisjs'
import testUtils from '@adonisjs/core/services/test_utils'
import { databaseRequired } from '#tests/helpers/test_database'

/**
 * This file is imported by the "bin/test.ts" entrypoint file
 */

/**
 * Configure Japa plugins in the plugins array.
 * Learn more - https://japa.dev/docs/runner-config#plugins-optional
 */
export const plugins: Config['plugins'] = [assert(), apiClient(), pluginAdonisJS(app)]

/**
 * Configure lifecycle function to run before and after all the
 * tests.
 *
 * For database-backed runs we migrate once up-front and roll back at the very
 * end (the container is created/destroyed in bin/test.ts). Per-test isolation is
 * handled by truncation in `configureSuite`.
 */
export const runnerHooks: Required<Pick<Config, 'setup' | 'teardown'>> = {
  setup: databaseRequired() ? [() => testUtils.db().migrate()] : [],
  teardown: [],
}

/**
 * Configure suites by tapping into the test suite instance.
 * Learn more - https://japa.dev/docs/test-suites#lifecycle-hooks
 */
export const configureSuite: Config['configureSuite'] = (suite) => {
  if (['browser', 'functional', 'e2e'].includes(suite.name)) {
    suite.setup(() => testUtils.httpServer().start())
  }

  // Truncate all tables after each database-backed test to keep them isolated.
  if (['integration', 'functional'].includes(suite.name)) {
    suite.onTest((t) => t.setup(() => testUtils.db().truncate()))
  }
}
