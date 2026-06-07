import { test } from '@japa/runner'
import {
  sanitizeUrl,
  SENSITIVE_HEADERS,
  isEnabled,
} from '../../app/payments/infrastructure/telemetry/otel.js'

test.group('OpenTelemetry Sanitization & Configuration', () => {
  test('redacts sensitive headers', ({ assert }) => {
    assert.deepEqual(SENSITIVE_HEADERS, [
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'x-app-key',
      'proxy-authorization',
      'token',
    ])
  })

  test('redacts sensitive query parameters from URL', ({ assert }) => {
    const urlsToTest = [
      {
        input: 'http://example.com/api/v1/payments?token=secret123&other=public',
        expected: 'http://example.com/api/v1/payments?token=%5BREDACTED%5D&other=public',
      },
      {
        input: 'https://example.com/login?password=my-password&username=user1',
        expected: 'https://example.com/login?password=%5BREDACTED%5D&username=user1',
      },
      {
        input: '/v1/pay?apikey=key123&amount=100',
        expected: '/v1/pay?apikey=%5BREDACTED%5D&amount=100',
      },
      {
        input: '/v1/pay?signature=xyz&client=123',
        expected: '/v1/pay?signature=%5BREDACTED%5D&client=123',
      },
      {
        input: 'http://localhost/health',
        expected: 'http://localhost/health',
      },
    ]

    for (const { input, expected } of urlsToTest) {
      assert.equal(sanitizeUrl(input), expected)
    }
  })

  test('keeps non-sensitive query parameters intact', ({ assert }) => {
    const url = 'http://example.com/api/v1/payments?amount=1000&currency=BRL'
    assert.equal(sanitizeUrl(url), url)
  })

  test('respects OTEL_ENABLED environment variable', ({ assert }) => {
    const expected = process.env.OTEL_ENABLED === 'true'
    assert.equal(isEnabled, expected)
  })
})
