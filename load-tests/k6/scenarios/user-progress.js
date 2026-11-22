import http from 'k6/http';
import { check, group, sleep } from 'k6';
import exec from 'k6/execution';
import { loadConfig } from '../config/environment.js';
import { authHeaders, getAuthToken, handleUnauthorized, initAuthPool } from '../helpers/auth.js';
import {
  buildQueryString,
  getProgressSubject,
  getProgressTopic,
  randomBetween,
  safeJson,
} from '../helpers/data.js';
import {
  createSummaryHandler,
  recordPrometheusSetup,
  recordPrometheusTeardown,
  scrapePrometheusMetrics,
} from '../helpers/reporting.js';
import {
  buildThresholds,
  journeySuccessRate,
  progressRequestsTotal,
  prometheusGauges,
  recordHttpOutcome,
  userProgressDurationMs,
} from '../helpers/thresholds.js';

const config = loadConfig(undefined, { scenarioName: 'user-progress' });

export const options = {
  scenarios: {
    user_progress: {
      executor: 'ramping-vus',
      exec: 'default',
      startVUs: 0,
      stages: config.profile.stages,
      gracefulRampDown: '20s',
      tags: { scenario: 'user_progress', env: config.envName, profile: config.profileName },
    },
  },
  tags: {
    scenario: 'user_progress',
    env: config.envName,
    profile: config.profileName,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: buildThresholds({
    profileName: config.profileName,
    strictSlo: config.strictSlo,
    includeProgress: true,
    includeJourneyRate: true,
  }),
};

function requestAuthed(method, url, body, tags, tokenState, data, activeConfig) {
  const send = (tok) => {
    const opts = { headers: authHeaders(tok), tags };
    return method === 'PATCH' ? http.patch(url, body, opts) : http.get(url, opts);
  };
  let res = send(tokenState.token);
  if (res.status === 401) {
    const refreshed = handleUnauthorized(data, activeConfig);
    if (refreshed) {
      tokenState.token = refreshed;
      res = send(tokenState.token);
    }
  }
  progressRequestsTotal.add(1, { scenario: 'user_progress' });
  userProgressDurationMs.add(res.timings.duration, { scenario: 'user_progress' });
  recordHttpOutcome(res, tags);
  return res;
}

export function runUserProgressScenario(data, activeConfig = config) {
  const tokenState = { token: getAuthToken(data, activeConfig) };
  const subject = getProgressSubject(activeConfig);
  const topic = getProgressTopic(activeConfig, exec.vu.iterationInScenario);
  let journeyOk = true;

  const baseTags = {
    scenario: 'user_progress',
    endpoint: 'user_progress',
    profile: activeConfig.profileName,
  };

  group('01_profile_and_progress_reads', () => {
    const meRes = requestAuthed('GET', `${activeConfig.baseUrl}/users/me`, null, baseTags, tokenState, data, activeConfig);
    const meBody = safeJson(meRes);
    const meOk = check(meRes, {
      'GET /users/me status is 200': (r) => r.status === 200,
      'GET /users/me returns user id': () => Boolean(meBody?.id),
    });
    if (!meOk) journeyOk = false;

    const privQuery = buildQueryString({ subject });
    const privRes = requestAuthed(
      'GET',
      `${activeConfig.baseUrl}/api/progress/topics/private${privQuery}`,
      null,
      baseTags,
      tokenState,
      data,
      activeConfig,
    );
    const privBody = safeJson(privRes);
    const privOk = check(privRes, {
      'GET /api/progress/topics/private status is 200': (r) => r.status === 200,
      'private topic progress has userProgress': () => Boolean(privBody?.userProgress && typeof privBody.userProgress === 'object'),
    });
    if (!privOk) journeyOk = false;

    const pubRes = requestAuthed(
      'GET',
      `${activeConfig.baseUrl}/api/progress/topics${privQuery}`,
      null,
      baseTags,
      tokenState,
      data,
      activeConfig,
    );
    const pubBody = safeJson(pubRes);
    const pubOk = check(pubRes, {
      'GET /api/progress/topics status is 200': (r) => r.status === 200,
      'public topic progress has totals': () => Boolean(pubBody?.totals && typeof pubBody.totals === 'object'),
    });
    if (!pubOk) journeyOk = false;

    const goalRes = requestAuthed(
      'GET',
      `${activeConfig.baseUrl}/users/me/study-goal`,
      null,
      baseTags,
      tokenState,
      data,
      activeConfig,
    );
    const goalBody = safeJson(goalRes);
    const goalOk = check(goalRes, {
      'GET /users/me/study-goal status is 200': (r) => r.status === 200,
      'study-goal returns numeric dailyGoalMinutes': () => typeof goalBody?.dailyGoalMinutes === 'number',
    });
    if (!goalOk) journeyOk = false;
  });

  if (activeConfig.thinkTimeScale > 0) {
    sleep(randomBetween(0.2, 0.5) * activeConfig.thinkTimeScale);
  }

  group('02_progress_and_usage_writes', () => {
    const progressRes = requestAuthed(
      'PATCH',
      `${activeConfig.baseUrl}/users/me/progress`,
      JSON.stringify({ topic, attempted: 1, correct: 1 }),
      baseTags,
      tokenState,
      data,
      activeConfig,
    );
    const progressBody = safeJson(progressRes);
    const progressOk = check(progressRes, {
      'PATCH /users/me/progress status is 200': (r) => r.status === 200,
      'PATCH /users/me/progress returns progress map': () => Boolean(progressBody?.progress),
    });
    if (!progressOk) journeyOk = false;

    const usageRes = requestAuthed(
      'PATCH',
      `${activeConfig.baseUrl}/users/me/usage`,
      JSON.stringify({ activeSeconds: 30, timezone: 'Asia/Kolkata' }),
      baseTags,
      tokenState,
      data,
      activeConfig,
    );
    const usageBody = safeJson(usageRes);
    const usageOk = check(usageRes, {
      'PATCH /users/me/usage status is 200': (r) => r.status === 200,
      'PATCH /users/me/usage returns dateKey': () => Boolean(usageBody?.dateKey),
    });
    if (!usageOk) journeyOk = false;

    const goalPatchRes = requestAuthed(
      'PATCH',
      `${activeConfig.baseUrl}/users/me/study-goal`,
      JSON.stringify({ dailyGoalMinutes: 60 }),
      baseTags,
      tokenState,
      data,
      activeConfig,
    );
    const goalPatchBody = safeJson(goalPatchRes);
    const goalPatchOk = check(goalPatchRes, {
      'PATCH /users/me/study-goal status is 200': (r) => r.status === 200,
      'PATCH /users/me/study-goal returns ok': () => goalPatchBody?.ok === true,
    });
    if (!goalPatchOk) journeyOk = false;
  });

  journeySuccessRate.add(journeyOk, { scenario: 'user_progress' });
  if (activeConfig.thinkTimeScale > 0) {
    sleep(randomBetween(0.4, 1.0) * activeConfig.thinkTimeScale);
  }
}

export function setup() {
  const healthRes = http.get(`${config.baseUrl}/api/health`, {
    tags: { endpoint: 'health_check', profile: config.profileName },
  });
  check(healthRes, { 'setup: /api/health returns 200': (r) => r.status === 200 });

  const auth = initAuthPool(config, { requireAuth: true });
  const beforeMetrics = scrapePrometheusMetrics(http, config, 'before');
  recordPrometheusSetup(prometheusGauges, beforeMetrics);

  return {
    ...auth,
    beforeMetrics,
    startedAt: new Date().toISOString(),
  };
}

export default function (data) {
  runUserProgressScenario(data, config);
}

export function teardown(data) {
  recordPrometheusTeardown(prometheusGauges, data, http, config);
}

export const handleSummary = createSummaryHandler(config, { scenarioName: 'user-progress' });
