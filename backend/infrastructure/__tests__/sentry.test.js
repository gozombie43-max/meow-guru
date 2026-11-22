import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sentryMocks = vi.hoisted(() => ({
  init: vi.fn(),
  setupExpressErrorHandler: vi.fn(),
  captureException: vi.fn(() => 'evt-test-123'),
  withScope: vi.fn((cb) => {
    const scope = {
      setTag: vi.fn(),
      setExtra: vi.fn(),
      setExtras: vi.fn(),
      setUser: vi.fn(),
    };
    cb(scope);
    sentryMocks.lastScope = scope;
  }),
  getIsolationScope: vi.fn(() => ({
    setTag: vi.fn(),
    setExtra: vi.fn(),
    setUser: vi.fn(),
  })),
  close: vi.fn(async () => true),
  lastScope: null,
}));

vi.mock('@sentry/node', () => sentryMocks);

import {
  initSentry,
  attachSentryErrorHandler,
  captureException,
  scrubSentryEvent,
  isSentryEnabled,
  _resetSentryForTests,
} from '../sentry.js';
import { errorHandler } from '../../middleware/errorHandler.js';

describe('Backend Sentry Infrastructure', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    sentryMocks.lastScope = null;
    _resetSentryForTests();
    delete process.env.SENTRY_DSN;
    delete process.env.SENTRY_TRACES_SAMPLE_RATE;
    delete process.env.DEPLOYMENT_ENVIRONMENT;
    delete process.env.OTEL_ENABLED;
  });

  afterEach(() => {
    _resetSentryForTests();
    process.env = { ...originalEnv };
  });

  it('acts as a clean no-op when SENTRY_DSN is unset', () => {
    expect(initSentry()).toBe(false);
    expect(isSentryEnabled()).toBe(false);
    expect(sentryMocks.init).not.toHaveBeenCalled();

    const app = { use: vi.fn() };
    expect(attachSentryErrorHandler(app)).toBe(false);
    expect(app.use).not.toHaveBeenCalled();
    expect(sentryMocks.setupExpressErrorHandler).not.toHaveBeenCalled();

    const eventId = captureException(new Error('boom'), { requestId: 'req-1' });
    expect(eventId).toBeNull();
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it('initializes Sentry with release, environment, and scrubbers when SENTRY_DSN is set', () => {
    process.env.SENTRY_DSN = 'https://public@o123.ingest.sentry.io/456';
    process.env.DEPLOYMENT_ENVIRONMENT = 'staging';
    process.env.OTEL_ENABLED = 'true';

    expect(initSentry()).toBe(true);
    expect(isSentryEnabled()).toBe(true);
    expect(sentryMocks.init).toHaveBeenCalledTimes(1);

    const initConfig = sentryMocks.init.mock.calls[0][0];
    expect(initConfig.dsn).toBe('https://public@o123.ingest.sentry.io/456');
    expect(initConfig.environment).toBe('staging');
    expect(typeof initConfig.release).toBe('string');
    expect(initConfig.release.length).toBeGreaterThan(0);
    expect(initConfig.sendDefaultPii).toBe(false);
    expect(initConfig.skipOpenTelemetrySetup).toBe(true);
    expect(typeof initConfig.beforeSend).toBe('function');
    expect(typeof initConfig.beforeSendTransaction).toBe('function');

    const app = { use: vi.fn() };
    expect(attachSentryErrorHandler(app)).toBe(true);
    expect(app.use).toHaveBeenCalledTimes(1);
    expect(sentryMocks.setupExpressErrorHandler).toHaveBeenCalledWith(app);
  });

  it('scrubs sensitive headers, cookies, credentials, OTPs, reset tokens, and emails from events', () => {
    const toBase64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const fakeJwt = `${toBase64Url({ alg: 'HS256', typ: 'JWT' })}.${toBase64Url({ sub: 'user-1' })}.signature123`;
    const circular = { note: 'contact alice@example.com' };
    circular.self = circular;

    const rawEvent = {
      message: `Failed for alice@example.com with Bearer secret-token-99 and ${fakeJwt}`,
      user: {
        id: 'usr_42',
        email: 'alice@example.com',
        ip_address: '203.0.113.10',
        username: 'alice',
      },
      request: {
        url: 'https://api.example.com/auth/reset-password?token=reset-abc&email=alice@example.com&page=1',
        query_string: 'token=reset-abc&otp=123456&page=1',
        cookies: { refreshToken: 'rt-secret' },
        headers: {
          Authorization: 'Bearer top-secret',
          Cookie: 'refreshToken=rt-secret',
          'Set-Cookie': 'refreshToken=rt-new',
          'X-Access-Code': 'ACCESS-999',
          'X-Metrics-Token': 'metrics-secret',
          'X-Request-ID': 'req-safe-123',
          'Content-Type': 'application/json',
        },
        data: JSON.stringify({
          email: 'alice@example.com',
          password: 'SuperSecretPassword!',
          otpCode: '482910',
          resetToken: 'reset-xyz',
          safeField: 'algebra',
        }),
      },
      extra: {
        password: 'pw-1',
        resetToken: 'rt-1',
        otp: '999888',
        nested: circular,
        safeCount: 5,
      },
      breadcrumbs: [
        {
          category: 'http',
          message: 'POST /auth/login for bob@example.com Bearer tok123',
          data: {
            url: 'https://api.example.com/auth/verify?token=tok999',
            headers: {
              authorization: 'Bearer tok123',
              'x-access-code': 'code-1',
              accept: 'application/json',
            },
            email: 'bob@example.com',
            otp: '654321',
            status_code: 500,
          },
        },
      ],
    };

    const scrubbed = scrubSentryEvent(rawEvent);

    // Sensitive headers removed; safe headers preserved
    expect(scrubbed.request.headers.Authorization).toBeUndefined();
    expect(scrubbed.request.headers.Cookie).toBeUndefined();
    expect(scrubbed.request.headers['Set-Cookie']).toBeUndefined();
    expect(scrubbed.request.headers['X-Access-Code']).toBeUndefined();
    expect(scrubbed.request.headers['X-Metrics-Token']).toBeUndefined();
    expect(scrubbed.request.headers['X-Request-ID']).toBe('req-safe-123');
    expect(scrubbed.request.cookies).toBeUndefined();

    // URL and query string scrubbed
    expect(scrubbed.request.url).not.toContain('reset-abc');
    expect(scrubbed.request.url).not.toContain('alice@example.com');
    expect(scrubbed.request.url).toContain('page=1');
    expect(scrubbed.request.query_string).not.toContain('reset-abc');
    expect(scrubbed.request.query_string).not.toContain('123456');

    // JSON body scrubbed
    const parsedBody = JSON.parse(scrubbed.request.data);
    expect(parsedBody.email).toBe('[REDACTED]');
    expect(parsedBody.password).toBe('[REDACTED]');
    expect(parsedBody.otpCode).toBe('[REDACTED]');
    expect(parsedBody.resetToken).toBe('[REDACTED]');
    expect(parsedBody.safeField).toBe('algebra');

    // Extra & circular reference scrubbed
    expect(scrubbed.extra.password).toBe('[REDACTED]');
    expect(scrubbed.extra.resetToken).toBe('[REDACTED]');
    expect(scrubbed.extra.otp).toBe('[REDACTED]');
    expect(scrubbed.extra.nested.note).toBe('contact [REDACTED_EMAIL]');
    expect(scrubbed.extra.nested.self).toBe('[CIRCULAR]');
    expect(scrubbed.extra.safeCount).toBe(5);

    // Breadcrumbs scrubbed
    const crumb = scrubbed.breadcrumbs[0];
    expect(crumb.message).not.toContain('bob@example.com');
    expect(crumb.message).not.toContain('tok123');
    expect(crumb.data.headers.authorization).toBeUndefined();
    expect(crumb.data.headers['x-access-code']).toBeUndefined();
    expect(crumb.data.headers.accept).toBe('application/json');
    expect(crumb.data.email).toBe('[REDACTED]');
    expect(crumb.data.otp).toBe('[REDACTED]');
    expect(crumb.data.url).not.toContain('tok999');
    expect(crumb.data.status_code).toBe(500);

    // User PII stripped while preserving opaque user id
    expect(scrubbed.user).toEqual({ id: 'usr_42' });

    // Top-level message scrubbed
    expect(scrubbed.message).not.toContain('alice@example.com');
    expect(scrubbed.message).not.toContain('secret-token-99');
    expect(scrubbed.message).not.toContain(fakeJwt);
  });

  it('errorHandler captures unexpected 5xx errors in Sentry while skipping 4xx errors', () => {
    process.env.SENTRY_DSN = 'https://public@o123.ingest.sentry.io/456';
    initSentry();

    // 4xx error should be skipped
    const clientErr = Object.assign(new Error('Validation failed'), { status: 400 });
    const req4xx = { id: 'req-400', method: 'POST', originalUrl: '/api/questions', user: { id: 'u1' } };
    const json4xx = vi.fn();
    const res4xx = { status: vi.fn(() => ({ json: json4xx })) };
    errorHandler(clientErr, req4xx, res4xx, vi.fn());

    expect(res4xx.status).toHaveBeenCalledWith(400);
    expect(json4xx).toHaveBeenCalledWith({ error: 'Validation failed' });
    expect(sentryMocks.captureException).not.toHaveBeenCalled();

    // 5xx error should be captured with context
    const serverErr = new Error('Unexpected database failure');
    const req5xx = {
      id: 'req-500',
      method: 'GET',
      originalUrl: '/api/mocktest/ssc-cgl/slots?token=leakme',
      user: { id: 'u-99' },
    };
    const json5xx = vi.fn();
    const res5xx = { status: vi.fn(() => ({ json: json5xx })) };
    errorHandler(serverErr, req5xx, res5xx, vi.fn());

    expect(res5xx.status).toHaveBeenCalledWith(500);
    expect(json5xx).toHaveBeenCalledWith({ error: 'Unexpected database failure' });
    expect(sentryMocks.captureException).toHaveBeenCalledTimes(1);
    expect(sentryMocks.captureException).toHaveBeenCalledWith(serverErr);
    expect(sentryMocks.lastScope.setTag).toHaveBeenCalledWith('requestId', 'req-500');
    expect(sentryMocks.lastScope.setTag).toHaveBeenCalledWith('http.method', 'GET');
    expect(sentryMocks.lastScope.setExtra).toHaveBeenCalledWith(
      'path',
      '/api/mocktest/ssc-cgl/slots?token=%5BREDACTED%5D',
    );
    expect(sentryMocks.lastScope.setUser).toHaveBeenCalledWith({ id: 'u-99' });

    // If attachSentryErrorHandler already captured (res.sentry populated), errorHandler does not duplicate
    sentryMocks.captureException.mockClear();
    const resAlreadyCaptured = { sentry: 'evt-already-1', status: vi.fn(() => ({ json: vi.fn() })) };
    errorHandler(serverErr, req5xx, resAlreadyCaptured, vi.fn());
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });
});
