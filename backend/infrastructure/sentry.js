import * as Sentry from '@sentry/node';
import { getReleaseId } from './releaseInfo.js';

const REDACTED = '[REDACTED]';
const REDACTED_EMAIL = '[REDACTED_EMAIL]';
const REDACTED_JWT = '[REDACTED_JWT]';
const MAX_SCRUB_DEPTH = 8;
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'x-access-code',
  'x-metrics-token',
  'x-api-key',
  'x-auth-token',
  'x-csrf-token',
]);

const SENSITIVE_KEY_PATTERN = /(?:authorization|proxy[-_]?authorization|cookie|set[-_]?cookie|x[-_]?access[-_]?code|x[-_]?metrics[-_]?token|password|passwd|pwd|passcode|otp|verification[-_]?code|access[-_]?code|reset[-_]?token|refresh[-_]?token|access[-_]?token|id[-_]?token|auth[-_]?token|csrf[-_]?token|api[-_]?key|private[-_]?key|secret|token|email|email[-_]?normalized)/i;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

let sentryEnabled = false;
let initializedDsn = '';

function parseSampleRate(raw) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return 0;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(1, parsed);
}

function scrubString(value) {
  if (typeof value !== 'string' || !value) return value;
  return value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(JWT_PATTERN, REDACTED_JWT)
    .replace(EMAIL_PATTERN, REDACTED_EMAIL);
}

function scrubQueryString(queryString) {
  if (typeof queryString === 'string') {
    const trimmed = queryString.startsWith('?') ? queryString.slice(1) : queryString;
    if (!trimmed) return queryString;
    try {
      const params = new URLSearchParams(trimmed);
      const out = new URLSearchParams();
      for (const [key, val] of params.entries()) {
        if (SENSITIVE_KEY_PATTERN.test(key)) {
          out.append(key, REDACTED);
        } else {
          out.append(key, scrubString(val));
        }
      }
      return out.toString();
    } catch {
      return scrubString(queryString);
    }
  }
  if (queryString && typeof queryString === 'object') {
    return scrubValue(queryString, 0, new WeakSet());
  }
  return queryString;
}

function scrubUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) return rawUrl;
  const qIndex = rawUrl.indexOf('?');
  if (qIndex === -1) return scrubString(rawUrl);
  const base = scrubString(rawUrl.slice(0, qIndex));
  const query = scrubQueryString(rawUrl.slice(qIndex + 1));
  return query ? `${base}?${query}` : base;
}

function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object' || Array.isArray(headers)) {
    return headers;
  }
  const entries = [];
  for (const [key, value] of Object.entries(headers)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) continue;
    const lower = key.toLowerCase();
    if (SENSITIVE_HEADER_NAMES.has(lower) || SENSITIVE_KEY_PATTERN.test(lower)) {
      continue;
    }
    entries.push([
      key,
      typeof value === 'string' ? scrubString(value) : scrubValue(value, 1, new WeakSet()),
    ]);
  }
  return Object.fromEntries(entries);
}

function scrubValue(value, depth, seen) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return JSON.stringify(scrubValue(parsed, depth + 1, seen));
      } catch {
        return scrubString(value);
      }
    }
    return scrubString(value);
  }
  if (typeof value !== 'object') return value;
  if (depth >= MAX_SCRUB_DEPTH) return '[TRUNCATED]';
  if (seen.has(value)) return '[CIRCULAR]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, depth + 1, seen));
  }

  const entries = [];
  for (const [key, val] of Object.entries(value)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) continue;
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      entries.push([key, REDACTED]);
    } else {
      entries.push([key, scrubValue(val, depth + 1, seen)]);
    }
  }
  return Object.fromEntries(entries);
}

/**
 * Strips authentication headers, cookies, credentials, OTPs, reset tokens,
 * emails, and bearer/JWT tokens from Sentry events before transmission.
 */
export function scrubSentryEvent(event) {
  if (!event || typeof event !== 'object') return event;

  const scrubbed = { ...event };

  if (scrubbed.request && typeof scrubbed.request === 'object') {
    const req = { ...scrubbed.request };
    if (req.headers) {
      req.headers = scrubHeaders(req.headers);
    }
    if ('cookies' in req) {
      delete req.cookies;
    }
    if (req.query_string !== undefined) {
      req.query_string = scrubQueryString(req.query_string);
    }
    if (typeof req.url === 'string') {
      req.url = scrubUrl(req.url);
    }
    if (req.data !== undefined) {
      req.data = scrubValue(req.data, 0, new WeakSet());
    }
    scrubbed.request = req;
  }

  if (scrubbed.extra && typeof scrubbed.extra === 'object') {
    scrubbed.extra = scrubValue(scrubbed.extra, 0, new WeakSet());
  }

  if (scrubbed.contexts && typeof scrubbed.contexts === 'object') {
    scrubbed.contexts = scrubValue(scrubbed.contexts, 0, new WeakSet());
  }

  if (scrubbed.tags && typeof scrubbed.tags === 'object') {
    const tagEntries = [];
    for (const [key, val] of Object.entries(scrubbed.tags)) {
      if (FORBIDDEN_OBJECT_KEYS.has(key) || SENSITIVE_KEY_PATTERN.test(key)) continue;
      tagEntries.push([key, typeof val === 'string' ? scrubString(val) : val]);
    }
    scrubbed.tags = Object.fromEntries(tagEntries);
  }

  if (Array.isArray(scrubbed.breadcrumbs)) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs.map((crumb) => {
      if (!crumb || typeof crumb !== 'object') return crumb;
      const next = { ...crumb };
      if (typeof next.message === 'string') {
        next.message = scrubString(next.message);
      }
      if (next.data && typeof next.data === 'object') {
        const nextData = { ...next.data };
        if (nextData.headers) {
          nextData.headers = scrubHeaders(nextData.headers);
        }
        if (typeof nextData.url === 'string') {
          nextData.url = scrubUrl(nextData.url);
        }
        next.data = scrubValue(nextData, 0, new WeakSet());
      }
      return next;
    });
  }

  if (scrubbed.user && typeof scrubbed.user === 'object') {
    const user = { ...scrubbed.user };
    delete user.email;
    delete user.ip_address;
    delete user.username;
    scrubbed.user = user;
  }

  if (typeof scrubbed.message === 'string') {
    scrubbed.message = scrubString(scrubbed.message);
  }

  return scrubbed;
}

export function isSentryEnabled() {
  return sentryEnabled;
}

export function initSentry(options = {}) {
  const dsn = String(options.dsn ?? process.env.SENTRY_DSN ?? '').trim();
  if (!dsn) {
    sentryEnabled = false;
    initializedDsn = '';
    return false;
  }

  if (sentryEnabled && initializedDsn === dsn) {
    return true;
  }

  const environment =
    options.environment ||
    process.env.DEPLOYMENT_ENVIRONMENT ||
    process.env.NODE_ENV ||
    'development';
  const tracesSampleRate =
    options.tracesSampleRate !== undefined
      ? parseSampleRate(options.tracesSampleRate)
      : parseSampleRate(process.env.SENTRY_TRACES_SAMPLE_RATE);

  Sentry.init({
    dsn,
    release: options.release || getReleaseId(),
    environment,
    sendDefaultPii: false,
    tracesSampleRate,
    // Avoid colliding with custom OpenTelemetry NodeSDK when OTEL_ENABLED=true.
    skipOpenTelemetrySetup: process.env.OTEL_ENABLED === 'true',
    beforeSend: (event) => scrubSentryEvent(event),
    beforeSendTransaction: (event) => scrubSentryEvent(event),
  });

  sentryEnabled = true;
  initializedDsn = dsn;
  return true;
}

export function attachSentryErrorHandler(app) {
  if (!sentryEnabled || !app || typeof app.use !== 'function') {
    return false;
  }

  app.use((err, req, _res, next) => {
    const status = Number(err?.status || err?.statusCode || 500);
    if (!Number.isFinite(status) || status >= 500) {
      const scope = Sentry.getIsolationScope?.();
      if (scope) {
        if (req?.id) scope.setTag('requestId', String(req.id));
        if (req?.method) scope.setTag('http.method', String(req.method));
        if (req?.originalUrl) scope.setExtra('path', scrubUrl(req.originalUrl));
        if (req?.user?.id) scope.setUser({ id: String(req.user.id) });
      }
    }
    next(err);
  });

  Sentry.setupExpressErrorHandler(app);
  return true;
}

export function captureException(err, context = {}) {
  if (!sentryEnabled || !err) {
    return null;
  }

  let eventId = null;
  Sentry.withScope((scope) => {
    if (context.requestId) scope.setTag('requestId', String(context.requestId));
    if (context.method) scope.setTag('http.method', String(context.method));
    if (context.path) scope.setExtra('path', scrubUrl(String(context.path)));
    if (context.userId) scope.setUser({ id: String(context.userId) });

    const extra = {};
    for (const [key, value] of Object.entries(context)) {
      if (key === 'requestId' || key === 'method' || key === 'path' || key === 'userId') continue;
      extra[key] = value;
    }
    if (Object.keys(extra).length > 0) {
      scope.setExtras(scrubValue(extra, 0, new WeakSet()));
    }
    eventId = Sentry.captureException(err);
  });
  return eventId;
}

export async function flushSentry(timeoutMs = 2000) {
  if (!sentryEnabled) return true;
  try {
    return await Sentry.close(timeoutMs);
  } catch {
    return false;
  }
}

export function _resetSentryForTests() {
  sentryEnabled = false;
  initializedDsn = '';
}
