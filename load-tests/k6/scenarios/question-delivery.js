import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { loadConfig } from '../config/environment.js';
import { authHeaders, getAuthToken, handleUnauthorized, initAuthPool } from '../helpers/auth.js';
import {
  buildQueryString,
  countAnswerKeyLeaks,
  getMetaFilterParams,
  getQuestionFilterParams,
  randomBetween,
  safeJson,
  trackUniqueQuestions,
} from '../helpers/data.js';
import {
  createSummaryHandler,
  recordPrometheusSetup,
  recordPrometheusTeardown,
  scrapePrometheusMetrics,
} from '../helpers/reporting.js';
import {
  answerKeyLeaksTotal,
  buildThresholds,
  duplicateQuestionsTotal,
  journeySuccessRate,
  legacyMetaDurationMs,
  legacyMetaRequestsTotal,
  legacySessionDurationMs,
  legacySessionRequestsTotal,
  prometheusGauges,
  recordHttpOutcome,
  unexpectedAuthFailuresTotal,
} from '../helpers/thresholds.js';

const config = loadConfig(undefined, { scenarioName: 'question-delivery' });

export const options = {
  scenarios: {
    question_delivery: {
      executor: 'ramping-vus',
      exec: 'default',
      startVUs: 0,
      stages: config.profile.stages,
      gracefulRampDown: '20s',
      tags: { scenario: 'question_delivery', env: config.envName, profile: config.profileName },
    },
  },
  tags: {
    scenario: 'question_delivery',
    env: config.envName,
    profile: config.profileName,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: buildThresholds({
    profileName: config.profileName,
    strictSlo: config.strictSlo,
    includeLegacy: true,
    includeJourneyRate: true,
  }),
};

function requestWithOptionalAuth(url, tags, data, activeConfig) {
  const token = getAuthToken(data, activeConfig);
  const headers = token ? authHeaders(token) : {};
  let res = http.get(url, { headers, tags });
  if (res.status === 401 && token) {
    const refreshed = handleUnauthorized(data, activeConfig);
    if (refreshed) {
      res = http.get(url, { headers: authHeaders(refreshed), tags });
    }
  }
  return res;
}

export function runLegacyQuestionDelivery(data, activeConfig = config, opts = {}) {
  const metaFilters = getMetaFilterParams(activeConfig);
  const sessionFilters = getQuestionFilterParams(activeConfig);
  const seenUids = new Set();
  let journeyOk = true;

  group('legacy_questions_meta', () => {
    const metaQuery = buildQueryString(metaFilters);
    const metaRes = requestWithOptionalAuth(
      `${activeConfig.baseUrl}/api/questions/meta${metaQuery}`,
      { endpoint: 'legacy_meta', redis_mode: activeConfig.redisMode, profile: activeConfig.profileName },
      data,
      activeConfig,
    );
    legacyMetaRequestsTotal.add(1, { redis_mode: activeConfig.redisMode });
    legacyMetaDurationMs.add(metaRes.timings.duration, { redis_mode: activeConfig.redisMode });
    recordHttpOutcome(metaRes, { endpoint: 'legacy_meta' });

    const metaBody = safeJson(metaRes);
    const metaOk = check(metaRes, {
      'legacy /api/questions/meta status is 200': (r) => r.status === 200,
      'legacy /api/questions/meta returns numeric total': () => typeof metaBody?.total === 'number',
    });
    if (!metaOk) {
      if (metaRes.status === 401) unexpectedAuthFailuresTotal.add(1, { endpoint: 'legacy_meta' });
      journeyOk = false;
    }
  });

  if (activeConfig.thinkTimeScale > 0) {
    sleep(randomBetween(0.3, 0.9) * activeConfig.thinkTimeScale);
  }

  group('legacy_questions_session', () => {
    const sessionQuery = buildQueryString({ ...sessionFilters, limit: activeConfig.legacyLimit });
    const sessionRes = requestWithOptionalAuth(
      `${activeConfig.baseUrl}/api/questions/session${sessionQuery}`,
      {
        endpoint: 'legacy_questions_session',
        redis_mode: activeConfig.redisMode,
        profile: activeConfig.profileName,
      },
      data,
      activeConfig,
    );
    legacySessionRequestsTotal.add(1, { redis_mode: activeConfig.redisMode });
    legacySessionDurationMs.add(sessionRes.timings.duration, { redis_mode: activeConfig.redisMode });
    recordHttpOutcome(sessionRes, { endpoint: 'legacy_questions_session' });

    const body = safeJson(sessionRes);
    const questions = Array.isArray(body?.questions) ? body.questions : [];
    const leaks = countAnswerKeyLeaks(questions);
    const dups = trackUniqueQuestions(questions, seenUids);

    if (leaks > 0) answerKeyLeaksTotal.add(leaks, { endpoint: 'legacy_questions_session' });
    if (dups > 0) duplicateQuestionsTotal.add(dups, { endpoint: 'legacy_questions_session' });

    const sessionOk = check(sessionRes, {
      'legacy /api/questions/session status is 200': (r) => r.status === 200,
      'legacy session returns questions array': () => Array.isArray(body?.questions),
      'legacy session has zero answer-key leaks': () => leaks === 0,
      'legacy session has zero duplicate questions': () => dups === 0,
    });
    if (!sessionOk) {
      if (sessionRes.status === 401) unexpectedAuthFailuresTotal.add(1, { endpoint: 'legacy_questions_session' });
      journeyOk = false;
    }

    if (sessionOk && body?.hasMore && body?.nextCursor) {
      const pageQuery = buildQueryString({
        ...sessionFilters,
        cursor: body.nextCursor,
        limit: activeConfig.legacyLimit,
      });
      const pageRes = requestWithOptionalAuth(
        `${activeConfig.baseUrl}/api/questions/session${pageQuery}`,
        {
          endpoint: 'legacy_questions_session',
          redis_mode: activeConfig.redisMode,
          profile: activeConfig.profileName,
          page: 'cursor_2',
        },
        data,
        activeConfig,
      );
      legacySessionRequestsTotal.add(1, { redis_mode: activeConfig.redisMode });
      legacySessionDurationMs.add(pageRes.timings.duration, { redis_mode: activeConfig.redisMode });
      recordHttpOutcome(pageRes, { endpoint: 'legacy_questions_session' });

      const pageBody = safeJson(pageRes);
      const pageQuestions = Array.isArray(pageBody?.questions) ? pageBody.questions : [];
      const pageLeaks = countAnswerKeyLeaks(pageQuestions);
      const pageDups = trackUniqueQuestions(pageQuestions, seenUids);
      if (pageLeaks > 0) answerKeyLeaksTotal.add(pageLeaks, { endpoint: 'legacy_questions_session' });
      if (pageDups > 0) duplicateQuestionsTotal.add(pageDups, { endpoint: 'legacy_questions_session' });

      const pageOk = check(pageRes, {
        'legacy cursor page status is 200': (r) => r.status === 200,
        'legacy cursor page has zero leaks': () => pageLeaks === 0,
        'legacy cursor page has zero duplicates': () => pageDups === 0,
      });
      if (!pageOk) journeyOk = false;
    }
  });

  if (!opts.skipJourneyRate) {
    journeySuccessRate.add(journeyOk, { scenario: 'question_delivery' });
  }
  if (activeConfig.thinkTimeScale > 0) {
    sleep(randomBetween(0.6, 1.5) * activeConfig.thinkTimeScale);
  }
  return journeyOk;
}

export function runQuestionDeliveryScenario(data, activeConfig = config) {
  const metaFilters = getMetaFilterParams(activeConfig);
  const questionFilters = getQuestionFilterParams(activeConfig);
  let journeyOk = true;

  group('01_topic_counts', () => {
    const query = buildQueryString({ subject: metaFilters.subject || 'mathematics' });
    const res = requestWithOptionalAuth(
      `${activeConfig.baseUrl}/api/questions/topic-counts${query}`,
      { scenario: 'question_delivery', endpoint: 'question_topic_counts', profile: activeConfig.profileName },
      data,
      activeConfig,
    );
    recordHttpOutcome(res, { scenario: 'question_delivery', endpoint: 'question_topic_counts' });
    const body = safeJson(res);
    const ok = check(res, {
      'GET /api/questions/topic-counts status is 200': (r) => r.status === 200,
      'topic-counts returns totals object': () => Boolean(body?.totals && typeof body.totals === 'object'),
    });
    if (!ok) journeyOk = false;
  });

  group('02_question_counts', () => {
    const query = buildQueryString(metaFilters);
    const res = requestWithOptionalAuth(
      `${activeConfig.baseUrl}/api/questions/counts${query}`,
      { scenario: 'question_delivery', endpoint: 'question_counts', profile: activeConfig.profileName },
      data,
      activeConfig,
    );
    recordHttpOutcome(res, { scenario: 'question_delivery', endpoint: 'question_counts' });
    const body = safeJson(res);
    const ok = check(res, {
      'GET /api/questions/counts status is 200': (r) => r.status === 200,
      'counts returns numeric concept count': () => typeof body?.concept === 'number',
    });
    if (!ok) journeyOk = false;
  });

  group('03_questions_list', () => {
    const query = buildQueryString({ ...questionFilters, limit: 20 });
    const res = requestWithOptionalAuth(
      `${activeConfig.baseUrl}/api/questions${query}`,
      { scenario: 'question_delivery', endpoint: 'questions_list', profile: activeConfig.profileName },
      data,
      activeConfig,
    );
    recordHttpOutcome(res, { scenario: 'question_delivery', endpoint: 'questions_list' });
    const body = safeJson(res);
    const questions = Array.isArray(body?.questions) ? body.questions : [];
    const leaks = countAnswerKeyLeaks(questions);
    if (leaks > 0) answerKeyLeaksTotal.add(leaks, { endpoint: 'questions_list' });

    const ok = check(res, {
      'GET /api/questions status is 200': (r) => r.status === 200,
      'GET /api/questions returns array': () => Array.isArray(body?.questions),
      'GET /api/questions has zero answer-key leaks': () => leaks === 0,
    });
    if (!ok) journeyOk = false;
  });

  // Exercises /meta + /session + cursor pagination
  const legacyOk = runLegacyQuestionDelivery(data, activeConfig, { skipJourneyRate: true });
  journeySuccessRate.add(journeyOk && legacyOk, { scenario: 'question_delivery' });
}

export function setup() {
  const healthRes = http.get(`${config.baseUrl}/api/health`, {
    tags: { endpoint: 'health_check', profile: config.profileName },
  });
  check(healthRes, { 'setup: /api/health returns 200': (r) => r.status === 200 });

  const auth = initAuthPool(config, { requireAuth: false });
  const beforeMetrics = scrapePrometheusMetrics(http, config, 'before');
  recordPrometheusSetup(prometheusGauges, beforeMetrics);

  return {
    ...auth,
    beforeMetrics,
    startedAt: new Date().toISOString(),
  };
}

export default function (data) {
  runQuestionDeliveryScenario(data, config);
}

export function teardown(data) {
  recordPrometheusTeardown(prometheusGauges, data, http, config);
}

export const handleSummary = createSummaryHandler(config, { scenarioName: 'question-delivery' });
