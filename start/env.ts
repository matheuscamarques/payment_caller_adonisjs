/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for configuring database connection
  |----------------------------------------------------------
  */
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),

  /*
  |----------------------------------------------------------
  | Variables for the external payment provider
  |----------------------------------------------------------
  */
  PAYMENT_PROVIDER_URL: Env.schema.string.optional(),
  PAYMENT_PROVIDER_TIMEOUT: Env.schema.number.optional(),
  PAYMENT_PROVIDER_RETRIES: Env.schema.number.optional(),
  PAYMENT_PROVIDER_RETRY_DELAY: Env.schema.number.optional(),
  PAYMENT_PROVIDER_CIRCUIT_FAILURES: Env.schema.number.optional(),
  PAYMENT_PROVIDER_CIRCUIT_COOLDOWN: Env.schema.number.optional(),
  KAFKA_BOOTSTRAP_SERVERS: Env.schema.string.optional(),
  KAFKA_CLIENT_ID: Env.schema.string.optional(),
  KAFKA_GROUP_ID: Env.schema.string.optional(),
  KAFKA_TOPIC: Env.schema.string.optional(),

  /*
  |----------------------------------------------------------
  | Variables for OpenTelemetry configuration
  |----------------------------------------------------------
  */
  OTEL_ENABLED: Env.schema.boolean.optional(),
  OTEL_SERVICE_NAME: Env.schema.string.optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: Env.schema.string.optional(),
  OTEL_EXPORTER: Env.schema.string.optional(),
})
