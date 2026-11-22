import http from 'k6/http';
import { check, group, sleep } from 'k6';
import exec from 'k6/execution';
import { loadConfig } from '../config/environment.js';
import {
  authHeaders,
  getTrustedOrigin,
  loginIsolatedSession,
  logoutIsolatedSession,
  refreshIsolatedSession,
  resolveAuthInputs,
} from '../helpers/auth.js';
import { randomBetween, safeJson } from '../helpers/data.js';
import {
  createSummaryHandler,
  recordPrometheusSetup,
  recordPrometheusTeardown,
  scrapePrometheusMetrics,
} from '../helpers/reporting.js';
import {
  authJourneysTotal,
  buildThresholds,
  journeySuccessRate,
  prometheusGauges,
  recordHttpOutcome,
  unexpectedAuthFailuresTotal,
} from '../helpers/thresholds.js';

const config = loadConfig(undefined, { scenarioName: 'authentication' });

export const options = {
  scenarios: {
    authentication: {
      executor: 'ramping-vus',
      exec: 'default',
      startVUs: 0,
      stages: config.profile.stages,
      gracefulRampDown: '15s',
      tags: { scenario: 'authentication', env: config.envName, profile: config.profileName },
    },
  },
  tags: {
    scenario: 'authentication',
    env: config.envName,
    profile: config.profileName,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: buildThresholds({
    profileName: config.profileName,
    strictSlo: config.strictSlo,
    includeAuth: true,
    includeJourneyRate: true,
  }),
};

export function runAuthenticationScenario(data, activeConfig = config) {
  const accounts = data?.accounts?.length ? data.accounts : resolveAuthInputs(activeConfig.env).accounts;
  if (!accounts.length) {
    unexpectedAuthFailuresTotal.add(1, { scenario: 'authentication', step: 'config' });
    journeySuccessRate.add(false, { scenario: 'authentication' });
    return;
  }

  const idx = ((exec.vu.idInTest || 1) - 1) % accounts.length;
  const account = accounts[idx];
  const origin = data?.origin || getTrustedOrigin(activeConfig);
  const jar = http.cookieJar();
  let journeyOk = true;
  let token = null;
  let expectedUserId = null;

  group('01_auth_login', () => {
    const loginResult = loginIsolatedSession(activeConfig.baseUrl, account, jar, {
      scenario: 'authentication',
      profile: activeConfig.profileName,
    });
    authJourneysTotal.add(1, { scenario: 'authentication' });
    recordHttpOutcome(loginResult.res, { scenario: 'authentication', endpoint: 'auth_login' });

    const ok = check(loginResult.res, {
      'auth login status is 200': (r) => r.status === 200,
      'auth login returns access token': () => Boolean(loginResult.token),
      'auth login returns user id': () => Boolean(loginResult.user?.id),
    });
    if (!ok || !loginResult.token) {
      unexpectedAuthFailuresTotal.add(1, { scenario: 'authentication', step: 'login' });
      journeyOk = false;
      return;
    }
    token = loginResult.token;
    expectedUserId = loginResult.user?.id || null;
  });

  if (token) {
    group('02_auth_profile_before_refresh', () => {
      const meRes = http.get(`${activeConfig.baseUrl}/users/me`, {
        headers: authHeaders(token),
        jar,
        tags: { scenario: 'authentication', endpoint: 'users_me', profile: activeConfig.profileName },
      });
      recordHttpOutcome(meRes, { scenario: 'authentication', endpoint: 'users_me' });
      const meBody = safeJson(meRes);
      const ok = check(meRes, {
        'GET /users/me (pre-refresh) is 200': (r) => r.status === 200,
        'GET /users/me matches user id': () => !expectedUserId || meBody?.id === expectedUserId,
      });
      if (!ok) {
        if (meRes.status === 401 || meRes.status === 403) {
          unexpectedAuthFailuresTotal.add(1, { scenario: 'authentication', step: 'me_before_refresh' });
        }
        journeyOk = false;
      }
    });

    group('03_auth_refresh', () => {
      const refreshResult = refreshIsolatedSession(activeConfig.baseUrl, origin, jar, {
        scenario: 'authentication',
        profile: activeConfig.profileName,
      });
      recordHttpOutcome(refreshResult.res, { scenario: 'authentication', endpoint: 'auth_refresh' });
      const ok = check(refreshResult.res, {
        'POST /auth/refresh status is 200': (r) => r.status === 200,
        'POST /auth/refresh returns new token': () => Boolean(refreshResult.token),
      });
      if (!ok || !refreshResult.token) {
        unexpectedAuthFailuresTotal.add(1, { scenario: 'authentication', step: 'refresh' });
        journeyOk = false;
      } else {
        token = refreshResult.token;
      }
    });

    group('04_auth_profile_after_refresh', () => {
      const meRes = http.get(`${activeConfig.baseUrl}/users/me`, {
        headers: authHeaders(token),
        jar,
        tags: { scenario: 'authentication', endpoint: 'users_me', profile: activeConfig.profileName },
      });
      recordHttpOutcome(meRes, { scenario: 'authentication', endpoint: 'users_me' });
      const ok = check(meRes, {
        'GET /users/me (post-refresh) is 200': (r) => r.status === 200,
      });
      if (!ok) {
        if (meRes.status === 401 || meRes.status === 403) {
          unexpectedAuthFailuresTotal.add(1, { scenario: 'authentication', step: 'me_after_refresh' });
        }
        journeyOk = false;
      }
    });

    group('05_auth_logout', () => {
      const logoutResult = logoutIsolatedSession(activeConfig.baseUrl, origin, token, jar, {
        scenario: 'authentication',
        profile: activeConfig.profileName,
      });
      recordHttpOutcome(logoutResult.res, { scenario: 'authentication', endpoint: 'auth_logout' });
      const ok = check(logoutResult.res, {
        'POST /auth/logout status is 200': (r) => r.status === 200,
      });
      if (!ok) {
        if (logoutResult.status === 401 || logoutResult.status === 403) {
          unexpectedAuthFailuresTotal.add(1, { scenario: 'authentication', step: 'logout' });
        }
        journeyOk = false;
      }
    });
  }

  journeySuccessRate.add(journeyOk, { scenario: 'authentication' });

  // Respect authLimiter (100 req/15m per IP) in non-local environments.
  if (activeConfig.envName !== 'local') {
    const scale = Math.max(0.5, activeConfig.thinkTimeScale || 1);
    sleep(randomBetween(16, 24) * scale);
  } else if (activeConfig.thinkTimeScale > 0) {
    sleep(randomBetween(0.3, 0.8) * activeConfig.thinkTimeScale);
  }
}

export function setup() {
  const healthRes = http.get(`${config.baseUrl}/api/health`, {
    tags: { endpoint: 'health_check', profile: config.profileName },
  });
  check(healthRes, { 'setup: /api/health returns 200': (r) => r.status === 200 });

  const inputs = resolveAuthInputs(config.env);
  if (inputs.accounts.length === 0) {
    throw new Error(
      'authentication scenario requires credential accounts (K6_USERS_JSON/TEST_ACCOUNTS_JSON, numbered K6_USER_EMAIL_1..N, or K6_TEST_EMAIL + K6_TEST_PASSWORD).',
    );
  }
  if (config.envName !== 'local' && config.profile.peakVus > 5) {
    console.warn(
      `[k6][auth] Running authentication scenario with ${config.profile.peakVus} peak VUs in ${config.envName}; staging authLimiter enforces 100 req/15m per IP.`,
    );
  }

  const beforeMetrics = scrapePrometheusMetrics(http, config, 'before');
  recordPrometheusSetup(prometheusGauges, beforeMetrics);

  return {
    accounts: inputs.accounts,
    origin: getTrustedOrigin(config),
    beforeMetrics,
    startedAt: new Date().toISOString(),
  };
}

export default function (data) {
  runAuthenticationScenario(data, config);
}

export function teardown(data) {
  recordPrometheusTeardown(prometheusGauges, data, http, config);
}

export const handleSummary = createSummaryHandler(config, { scenarioName: 'authentication' });
