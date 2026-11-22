import http from 'k6/http';
import { sleep } from 'k6';
import exec from 'k6/execution';
import { resolveRuntimeEnv } from '../config/environment.js';
import { safeJson } from './data.js';
import { authLoginDurationMs, unexpectedAuthFailuresTotal } from './thresholds.js';

const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function decodeBase64UrlToUtf8(input) {
  const normalized = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);

  const bytes = [];
  for (let i = 0; i < padded.length; i += 4) {
    const c1 = BASE64_ALPHABET.indexOf(padded[i]);
    const c2 = BASE64_ALPHABET.indexOf(padded[i + 1]);
    const c3 = padded[i + 2] === '=' ? -1 : BASE64_ALPHABET.indexOf(padded[i + 2]);
    const c4 = padded[i + 3] === '=' ? -1 : BASE64_ALPHABET.indexOf(padded[i + 3]);
    if (c1 < 0 || c2 < 0) return null;

    bytes.push((c1 << 2) | (c2 >> 4));
    if (c3 >= 0) bytes.push(((c2 & 15) << 4) | (c3 >> 2));
    if (c4 >= 0) bytes.push(((c3 & 3) << 6) | c4);
  }

  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

export function parseJwtExpMs(token) {
  const parts = String(token || '').split('.');
  if (parts.length < 2) return null;
  try {
    const decoded = decodeBase64UrlToUtf8(parts[1]);
    if (!decoded) return null;
    const payload = JSON.parse(decoded);
    if (Number.isFinite(payload?.exp)) {
      return payload.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}

export function authHeaders(token, extra = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export function getTrustedOrigin(config = {}, envOverrides) {
  const env = resolveRuntimeEnv(envOverrides ?? config.env);
  const rawCors = String(env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .find(Boolean);
  const explicit = String(env.K6_ORIGIN || env.FRONTEND_URL || rawCors || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;
  if ((config.envName || 'local') === 'local') {
    return 'http://localhost:3000';
  }
  return String(config.baseUrl || '').replace(/\/+$/, '');
}

export function resolveAuthInputs(envOverrides) {
  const env = resolveRuntimeEnv(envOverrides);

  const tokensRaw = String(env.K6_AUTH_TOKENS || env.AUTH_TOKENS || '').trim();
  if (tokensRaw) {
    const tokens = tokensRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length > 0) {
      return { source: 'tokens', tokens, accounts: [] };
    }
  }

  const singleToken = String(env.K6_AUTH_TOKEN || env.AUTH_TOKEN || '').trim();
  if (singleToken) {
    return { source: 'token', tokens: [singleToken], accounts: [] };
  }

  const usersJsonRaw = String(env.K6_USERS_JSON || env.TEST_ACCOUNTS_JSON || '').trim();
  if (usersJsonRaw) {
    let parsed;
    try {
      parsed = JSON.parse(usersJsonRaw);
    } catch (err) {
      throw new Error(`Invalid K6_USERS_JSON / TEST_ACCOUNTS_JSON: ${err.message}`);
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('K6_USERS_JSON / TEST_ACCOUNTS_JSON must be a non-empty JSON array of { email, password }');
    }
    const accounts = parsed
      .map((item) => ({
        email: String(item?.email || '').trim(),
        password: String(item?.password || ''),
      }))
      .filter((item) => item.email && item.password);
    if (accounts.length === 0) {
      throw new Error('K6_USERS_JSON / TEST_ACCOUNTS_JSON contained no valid { email, password } entries');
    }
    return { source: 'users_json', tokens: [], accounts };
  }

  const numberedAccounts = [];
  for (let i = 1; i <= 200; i++) {
    const email = String(env[`K6_USER_EMAIL_${i}`] || env[`EMAIL_${i}`] || '').trim();
    const password = String(env[`K6_USER_PASSWORD_${i}`] || env[`PASSWORD_${i}`] || '');
    if (email && password) {
      numberedAccounts.push({ email, password });
    }
  }
  if (numberedAccounts.length > 0) {
    return { source: 'numbered', tokens: [], accounts: numberedAccounts };
  }

  const email = String(env.K6_TEST_EMAIL || env.TEST_EMAIL || '').trim();
  const password = String(env.K6_TEST_PASSWORD || env.TEST_PASSWORD || '');
  if (email && password) {
    return { source: 'single', tokens: [], accounts: [{ email, password }] };
  }

  return { source: 'none', tokens: [], accounts: [] };
}

export function loginIsolatedSession(baseUrl, account, jar, tags = {}) {
  const params = {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'auth_login', ...tags },
  };
  if (jar) params.jar = jar;

  const res = http.post(
    `${baseUrl}/auth/login`,
    JSON.stringify({ email: account.email, password: account.password }),
    params,
  );
  authLoginDurationMs.add(res.timings.duration);
  const body = safeJson(res);
  return {
    ok: res.status === 200 && Boolean(body?.token),
    status: res.status,
    token: body?.token || null,
    user: body?.user || null,
    error: body?.error || body?.message || null,
    code: body?.code || null,
    res,
  };
}

export function refreshIsolatedSession(baseUrl, origin, jar, tags = {}) {
  const params = {
    headers: { Origin: origin },
    tags: { endpoint: 'auth_refresh', ...tags },
  };
  if (jar) params.jar = jar;

  const res = http.post(`${baseUrl}/auth/refresh`, null, params);
  const body = safeJson(res);
  return {
    ok: res.status === 200 && Boolean(body?.token),
    status: res.status,
    token: body?.token || null,
    error: body?.error || body?.message || null,
    res,
  };
}

export function logoutIsolatedSession(baseUrl, origin, token, jar, tags = {}) {
  const headers = { Origin: origin };
  if (token) headers.Authorization = `Bearer ${token}`;

  const params = {
    headers,
    tags: { endpoint: 'auth_logout', ...tags },
  };
  if (jar) params.jar = jar;

  const res = http.post(`${baseUrl}/auth/logout`, null, params);
  const body = safeJson(res);
  return {
    ok: res.status === 200,
    status: res.status,
    body,
    res,
  };
}

export function initAuthPool(config, options = {}) {
  const requireAuth = options.requireAuth !== false;
  const inputs = resolveAuthInputs(config.env);
  const origin = getTrustedOrigin(config);

  if (inputs.source === 'none') {
    if (!requireAuth) {
      return {
        tokens: [],
        tokenExps: [],
        accounts: [],
        origin,
        hasAuth: false,
      };
    }
    throw new Error(
      'Authentication required: provide K6_AUTH_TOKENS/AUTH_TOKENS, K6_AUTH_TOKEN/AUTH_TOKEN, K6_USERS_JSON/TEST_ACCOUNTS_JSON, numbered K6_USER_EMAIL_1..N, or K6_TEST_EMAIL + K6_TEST_PASSWORD.',
    );
  }

  if (inputs.tokens.length > 0) {
    const tokenExps = inputs.tokens.map((t) => parseJwtExpMs(t));
    if (config.envName !== 'local' && (config.profile?.peakVus || 0) > 250 && inputs.tokens.length < 15) {
      console.warn(
        `[k6][auth] Pool size (${inputs.tokens.length}) is small for ${config.profile?.peakVus} VUs against staging questionReadLimiter (2400 req/15m/user).`,
      );
    }
    return {
      tokens: inputs.tokens,
      tokenExps,
      accounts: inputs.accounts,
      origin,
      hasAuth: true,
    };
  }

  if (config.envName !== 'local' && inputs.accounts.length > 90) {
    console.warn(
      `[k6][auth] Logging in ${inputs.accounts.length} accounts in setup() from one IP approaches staging authLimiter (100 req/15m/IP).`,
    );
  }
  if (config.envName !== 'local' && (config.profile?.peakVus || 0) > 250 && inputs.accounts.length < 15) {
    console.warn(
      `[k6][auth] Account pool size (${inputs.accounts.length}) is small for ${config.profile?.peakVus} VUs against staging questionReadLimiter (2400 req/15m/user).`,
    );
  }

  const tokens = [];
  const tokenExps = [];
  for (let i = 0; i < inputs.accounts.length; i++) {
    const acc = inputs.accounts[i];
    // Use a throwaway jar per setup login so setup refresh cookies are NEVER shared across VUs.
    const setupJar = http.cookieJar();
    const loginResult = loginIsolatedSession(config.baseUrl, acc, setupJar, {
      redis_mode: config.redisMode,
      profile: config.profileName,
    });
    if (!loginResult.ok) {
      throw new Error(
        `Setup login failed for account #${i + 1} (${acc.email}) with HTTP ${loginResult.status} (code=${loginResult.code || 'none'})`,
      );
    }
    tokens.push(loginResult.token);
    tokenExps.push(parseJwtExpMs(loginResult.token));
  }

  return {
    tokens,
    tokenExps,
    accounts: inputs.accounts,
    origin,
    hasAuth: true,
  };
}

// Per-VU isolated token cache (never shares refresh cookies from setup()).
let vuToken = null;
let vuExpiresAtMs = null;
let vuCookieJar = null;
let vuAccountIdx = null;
let vuLastReloginMs = 0;

const EXPIRY_REFRESH_WINDOW_MS = 120_000;
const RELOGIN_COOLDOWN_MS = 5_000;

function acquireIsolatedVuSession(data, config) {
  if (!data?.accounts?.length) return null;
  const now = Date.now();
  if (now - vuLastReloginMs < RELOGIN_COOLDOWN_MS && vuToken) {
    return vuToken;
  }

  if (config?.envName && config.envName !== 'local') {
    sleep(0.05 + Math.random() * 0.25);
  }

  const idx = ((exec.vu.idInTest || 1) - 1) % data.accounts.length;
  const account = data.accounts[idx];
  if (!account?.email || !account?.password) return null;

  const freshJar = http.cookieJar();
  vuLastReloginMs = Date.now();
  const result = loginIsolatedSession(config.baseUrl, account, freshJar, {
    redis_mode: config.redisMode,
    profile: config.profileName,
  });

  if (!result.ok || !result.token) {
    return null;
  }

  vuCookieJar = freshJar;
  vuToken = result.token;
  vuExpiresAtMs = parseJwtExpMs(result.token);
  vuAccountIdx = idx;
  return vuToken;
}

export function getAuthToken(data, config = {}) {
  if (!data?.tokens?.length) return null;

  const idx = ((exec.vu.idInTest || 1) - 1) % data.tokens.length;
  if (!vuToken || vuAccountIdx !== idx) {
    vuAccountIdx = idx;
    vuToken = data.tokens[idx];
    vuExpiresAtMs = data.tokenExps?.[idx] ?? parseJwtExpMs(vuToken);
    vuCookieJar = null;
  }

  if (vuExpiresAtMs && Date.now() >= vuExpiresAtMs - EXPIRY_REFRESH_WINDOW_MS) {
    if (vuCookieJar && config.baseUrl && data.origin) {
      const refreshed = refreshIsolatedSession(config.baseUrl, data.origin, vuCookieJar, {
        redis_mode: config.redisMode,
        profile: config.profileName,
      });
      if (refreshed.ok && refreshed.token) {
        vuToken = refreshed.token;
        vuExpiresAtMs = parseJwtExpMs(refreshed.token);
        return vuToken;
      }
      vuCookieJar = null;
    }

    const reauthed = acquireIsolatedVuSession(data, config);
    if (reauthed) {
      return reauthed;
    }
  }

  return vuToken;
}

export function handleUnauthorized(data, config = {}) {
  if (vuCookieJar && config.baseUrl && data?.origin) {
    const refreshed = refreshIsolatedSession(config.baseUrl, data.origin, vuCookieJar, {
      redis_mode: config.redisMode,
      profile: config.profileName,
    });
    if (refreshed.ok && refreshed.token) {
      vuToken = refreshed.token;
      vuExpiresAtMs = parseJwtExpMs(refreshed.token);
      return vuToken;
    }
    vuCookieJar = null;
  }

  const reauthed = acquireIsolatedVuSession(data, config);
  if (reauthed) {
    return reauthed;
  }

  unexpectedAuthFailuresTotal.add(1, {
    profile: config.profileName || 'unknown',
    env: config.envName || 'local',
  });
  return null;
}

export function resetVuAuthStateForTest() {
  vuToken = null;
  vuExpiresAtMs = null;
  vuCookieJar = null;
  vuAccountIdx = null;
  vuLastReloginMs = 0;
}
