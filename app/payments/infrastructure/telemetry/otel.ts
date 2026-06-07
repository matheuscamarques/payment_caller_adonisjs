import { NodeSDK } from '@opentelemetry/sdk-node'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base'
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'

// Set internal OpenTelemetry logger to warning level to avoid log spamming
diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN)

const isEnabled = process.env.OTEL_ENABLED === 'true'

let sdk: NodeSDK | null = null

// Sensitive headers that must be redacted to prevent credential leakage in traces
export const SENSITIVE_HEADERS = [
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'x-app-key',
  'proxy-authorization',
  'token',
]

// Sanitizes URLs by redacting sensitive query parameters
export const sanitizeUrl = (urlStr: string): string => {
  try {
    if (!urlStr) {
      return urlStr
    }
    const hasProtocol = urlStr.startsWith('http://') || urlStr.startsWith('https://')
    const url = new URL(urlStr, hasProtocol ? undefined : 'http://localhost')

    const sensitiveKeys = [
      'token',
      'key',
      'apikey',
      'secret',
      'password',
      'signature',
      'auth',
      'pass',
    ]
    let modified = false

    url.searchParams.forEach((_, key) => {
      if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
        url.searchParams.set(key, '[REDACTED]')
        modified = true
      }
    })

    if (hasProtocol) {
      return url.toString()
    }
    return url.pathname + (modified ? url.search : urlStr.slice(url.pathname.length))
  } catch {
    return urlStr
  }
}

if (isEnabled) {
  const serviceName = process.env.OTEL_SERVICE_NAME || 'payments-api'
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'

  // Determine trace exporter based on config (Console or OTLP collector)
  const traceExporter =
    process.env.OTEL_EXPORTER === 'console'
      ? new ConsoleSpanExporter()
      : new OTLPTraceExporter({ url: endpoint })

  sdk = new NodeSDK({
    serviceName,
    traceExporter,
    instrumentations: [
      new HttpInstrumentation({
        // Ignore trace noise for documentation, static assets and root health checks
        ignoreIncomingRequestHook: (req) => {
          const url = req.url || ''
          return (
            url.includes('/docs') ||
            url.includes('/swagger.json') ||
            url.includes('/favicon.ico') ||
            url === '/'
          )
        },
        // Sanitize incoming / outgoing request path and headers
        requestHook: (span, req: any) => {
          const rawUrl = req.url || (req.path ? `${req.host || ''}${req.path}` : '')
          if (rawUrl) {
            span.setAttribute('http.target.sanitized', sanitizeUrl(rawUrl))
          }

          const headers = req.headers || {}
          Object.keys(headers).forEach((key) => {
            const lowerKey = key.toLowerCase()
            if (SENSITIVE_HEADERS.includes(lowerKey)) {
              span.setAttribute(`http.request.header.${lowerKey}`, '[REDACTED]')
            }
          })
        },
        // Sanitize response headers
        responseHook: (span, res: any) => {
          const headers = res.headers || {}
          Object.keys(headers).forEach((key) => {
            const lowerKey = key.toLowerCase()
            if (SENSITIVE_HEADERS.includes(lowerKey)) {
              span.setAttribute(`http.response.header.${lowerKey}`, '[REDACTED]')
            }
          })
        },
      }),
      new PgInstrumentation({
        // Prevent tracing database queries unless they are initiated inside a request handler span
        requireParentSpan: true,
      }),
    ],
  })

  try {
    sdk.start()
    console.log(`[OpenTelemetry] Initialized successfully for service "${serviceName}"`)
  } catch (error) {
    console.error(
      '[OpenTelemetry] Failed to start SDK. Application will run without telemetry.',
      error
    )
  }
}

// Ensure graceful shutdown of telemetry on process exit
process.on('SIGTERM', () => {
  if (sdk) {
    sdk
      .shutdown()
      .then(() => console.log('[OpenTelemetry] SDK terminated successfully'))
      .catch((err) => console.error('[OpenTelemetry] Error during SDK shutdown', err))
  }
})
export { sdk, isEnabled }
