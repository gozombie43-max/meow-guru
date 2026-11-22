import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire, registerHooks } from 'node:module';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { MongoClient } from 'mongodb';

// ============================================================================
// Register lightweight synchronous k6/* ESM stubs for Node.js unit testing
// ============================================================================
const k6StubState = {
  vuId: 1,
  iter: 1,
  postCalls: [],
  getCalls: [],
  sleeps: [],
  postResponder: null,
};

globalThis.__k6StubState = k6StubState;

const K6_STUBS = {
  'k6/metrics': `
    export class Counter { constructor(name) { this.name = name; this.adds = []; } add(v, t) { this.adds.push({ v, t }); } }
    export class Trend { constructor(name, isTime) { this.name = name; this.isTime = isTime; this.adds = []; } add(v, t) { this.adds.push({ v, t }); } }
    export class Rate { constructor(name) { this.name = name; this.adds = []; } add(v, t) { this.adds.push({ v, t }); } }
    export class Gauge { constructor(name) { this.name = name; this.adds = []; } add(v, t) { this.adds.push({ v, t }); } }
  `,
  'k6/http': `
    export default {
      cookieJar() { return { _jarId: Math.random().toString(36).slice(2) }; },
      expectedStatuses(...s) { return { statuses: s }; },
      post(url, body, params) {
        globalThis.__k6StubState.postCalls.push({ url, body, params });
        if (globalThis.__k6StubState.postResponder) {
          return globalThis.__k6StubState.postResponder(url, body, params);
        }
        return { status: 200, body: '{}', json: () => ({}), timings: { duration: 10 } };
      },
      get(url, params) {
        globalThis.__k6StubState.getCalls.push({ url, params });
        return { status: 200, body: '{}', json: () => ({}), timings: { duration: 10 } };
      },
    };
  `,
  k6: `
    export function sleep(sec) { globalThis.__k6StubState.sleeps.push(sec); }
    export function check() { return true; }
    export function group(_name, fn) { return fn(); }
  `,
  'k6/execution': `
    export default {
      get vu() {
        return {
          idInTest: globalThis.__k6StubState.vuId,
          iterationInScenario: globalThis.__k6StubState.iter,
        };
      },
    };
  `,
};

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (Object.hasOwn(K6_STUBS, specifier)) {
      return { shortCircuit: true, url: `k6stub:${specifier}` };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('k6stub:')) {
      const key = url.slice('k6stub:'.length);
      return { shortCircuit: true, format: 'module', source: K6_STUBS[key] };
    }
    return nextLoad(url, context);
  },
});

const {
  LOAD_PROFILES,
  LEGACY_STAGE_PROFILES,
  getStageProfile,
  loadConfig,
  splitStages,
  stripUrlCredentials,
  validateTargetEnvironment,
} = await import('../config/environment.js');

const {
  classifyHttpResponse,
  countAnswerKeyLeaks,
  getMetaFilterParams,
  getQuestionFilterParams,
  makeIdempotencyKey,
  pickWeightedQuizMode,
  trackUniqueQuestions,
} = await import('../helpers/data.js');

const { buildThresholds } = await import('../helpers/thresholds.js');
const {
  buildSummaryReport,
  computePrometheusDeltas,
  evaluateThresholds,
  formatHumanSummary,
  parsePrometheusMetrics,
} = await import('../helpers/reporting.js');
const {
  getTrustedOrigin,
  getAuthToken,
  handleUnauthorized,
  parseJwtExpMs,
  resetVuAuthStateForTest,
  resolveAuthInputs,
} = await import('../helpers/auth.js');

const {
  assertSafeDatabaseTarget,
  buildNormalizedQuestionFields,
  buildSyntheticQuestionDoc,
  buildSyntheticUserDoc,
  computeAnswerIdempotencyIds,
  parseCliArgs,
  runCleanup,
  runSeed,
  runSetup,
  runStatus,
  stripMongoUriCredentials,
} = await import('../scripts/staging-test-data.mjs');

const require = createRequire(import.meta.url);
const { MongoMemoryServer } = require('../../../backend/node_modules/mongodb-memory-server');

function makeUnsignedJwt(payloadObj) {
  const encode = (obj) => Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payloadObj)}.sig`;
}

// ============================================================================
// 1. config/environment.js tests
// ============================================================================
test('environment.js exposes all 6 canonical load stage profiles + ramp + legacy stage1..6', () => {
  const expectedProfiles = ['smoke', 'baseline', 'moderate', 'target', 'stress', 'soak', 'ramp'];
  for (const name of expectedProfiles) {
    assert.ok(LOAD_PROFILES[name], `Missing LOAD_PROFILES.${name}`);
    assert.ok(Array.isArray(LOAD_PROFILES[name].stages) && LOAD_PROFILES[name].stages.length >= 3);
  }
  assert.equal(LOAD_PROFILES.smoke.peakVus, 5);
  assert.equal(LOAD_PROFILES.baseline.peakVus, 25);
  assert.equal(LOAD_PROFILES.moderate.peakVus, 100);
  assert.equal(LOAD_PROFILES.target.peakVus, 500);
  assert.equal(LOAD_PROFILES.stress.peakVus, 1000);
  assert.equal(LOAD_PROFILES.soak.peakVus, 150);

  for (const legacy of ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6']) {
    assert.ok(LEGACY_STAGE_PROFILES[legacy]);
    const resolved = getStageProfile(legacy, {});
    assert.equal(resolved.name, legacy);
  }
});

test('environment.js configures soak duration and clamps soak VUs', () => {
  const defaultSoak = getStageProfile('soak', {});
  assert.equal(defaultSoak.peakVus, 150);
  assert.equal(defaultSoak.stages[1].duration, '30m');

  const customSoak = getStageProfile('soak', { K6_SOAK_VUS: '250', K6_SOAK_DURATION: '45m' });
  assert.equal(customSoak.peakVus, 200);
  assert.equal(customSoak.stages[1].duration, '45m');

  assert.throws(() => getStageProfile('soak', { K6_SOAK_DURATION: '5m' }), /between 30m and 60m/);

  const dryRunSoak = getStageProfile('soak', { K6_SOAK_DURATION_OVERRIDE: '15s' });
  assert.equal(dryRunSoak.stages[1].duration, '15s');
});

test('environment.js enforces strict production blocklist and strips credentials from errors', () => {
  assert.throws(() => validateTargetEnvironment('production', 'http://127.0.0.1:10000', {}), /production/i);
  assert.throws(() => validateTargetEnvironment('prod', 'http://127.0.0.1:10000', {}), /production/i);
  assert.throws(
    () => validateTargetEnvironment('staging', 'https://api.prod.meowguru.com', { K6_ALLOW_STAGING: 'true' }),
    /production-looking/i,
  );
  assert.throws(
    () => validateTargetEnvironment('local', 'https://staging.example.com', {}),
    /loopback/i,
  );
  assert.throws(
    () => validateTargetEnvironment('staging', '', { K6_ALLOW_STAGING: 'true' }),
    /requires an explicit BASE_URL/i,
  );
  assert.throws(
    () => validateTargetEnvironment('staging', 'https://quizguru-stage.azurewebsites.net', {}),
    /K6_ALLOW_STAGING=true/,
  );
  assert.throws(
    () =>
      validateTargetEnvironment(
        'staging',
        'https://mysecretuser:mysecretpass@quizguru-stage.azurewebsites.net',
        { K6_ALLOW_STAGING: 'true' },
      ),
    (err) => {
      assert.ok(!err.message.includes('mysecretuser'));
      assert.ok(!err.message.includes('mysecretpass'));
      assert.ok(err.message.includes('***@'));
      return true;
    },
  );
  assert.equal(stripUrlCredentials('https://u:p@example.com/a'), 'https://***@example.com/a');

  const okLocal = loadConfig({ K6_ENV: 'local', K6_PROFILE: 'baseline' });
  assert.equal(okLocal.envName, 'local');
  assert.equal(okLocal.baseUrl, 'http://127.0.0.1:10000');
  assert.equal(okLocal.profileName, 'baseline');

  const okStaging = loadConfig({
    K6_ENV: 'staging',
    BASE_URL: 'https://quizguru-stage.azurewebsites.net/',
    K6_ALLOW_STAGING: 'true',
    QUIZ_MODE: 'practice',
  });
  assert.equal(okStaging.envName, 'staging');
  assert.equal(okStaging.baseUrl, 'https://quizguru-stage.azurewebsites.net');
  assert.equal(okStaging.quizMode, 'practice');

  assert.throws(() => loadConfig({ QUIZ_MODE: 'invalid_mode' }), /Invalid QUIZ_MODE/);
});

test('environment.js splitStages preserves 0 ramp-down and ensures at least 1 VU when requested', () => {
  const split = splitStages(
    [
      { duration: '10s', target: 5 },
      { duration: '10s', target: 0 },
    ],
    0.05,
    true,
  );
  assert.deepEqual(split, [
    { duration: '10s', target: 1 },
    { duration: '10s', target: 0 },
  ]);
});

// ============================================================================
// 2. helpers/thresholds.js & helpers/reporting.js tests
// ============================================================================
test('thresholds.js only enables endpoint thresholds for active scenarios and toggles strictSlo', () => {
  const healthOnly = buildThresholds({ includeHealth: true, strictSlo: false });
  assert.ok(healthOnly['http_req_duration{endpoint:health_check}']);
  assert.equal(healthOnly['http_req_duration{endpoint:questions_batch}'], undefined);
  assert.deepEqual(healthOnly.http_req_failed, ['rate<0.01']);
  assert.deepEqual(healthOnly.unexpected_auth_failures_total, ['count==0']);
  assert.deepEqual(healthOnly.unhandled_5xx_total, ['count==0']);

  const strictQuiz = buildThresholds({ includeQuizSession: true, strictSlo: true });
  assert.deepEqual(strictQuiz['http_req_duration{endpoint:questions_batch}'], ['p(95)<200', 'p(99)<400']);
  assert.deepEqual(strictQuiz.http_req_failed, ['rate<0.001']);
});

test('reporting.js fails on http_reqs == 0 (NO_SAMPLES) and never returns false PASS', () => {
  const emptyRunData = {
    state: { testRunDurationMs: 5000 },
    metrics: {
      http_reqs: { type: 'counter', values: { count: 0, rate: 0 } },
      http_req_failed: { type: 'rate', values: { rate: 0 }, thresholds: { 'rate<0.01': { ok: true } } },
      checks: { type: 'rate', values: { passes: 0, fails: 0, rate: 0 }, thresholds: { 'rate>0.99': { ok: true } } },
      'http_req_duration{endpoint:questions_batch}': {
        type: 'trend',
        values: { avg: 0, min: 0, med: 0, max: 0, 'p(90)': 0, 'p(95)': 0, 'p(99)': 0 },
        thresholds: { 'p(95)<500': { ok: true } },
      },
      questions_batch_requests_total: { type: 'counter', values: { count: 0 } },
    },
  };

  const report = buildSummaryReport(emptyRunData, {
    envName: 'local',
    profileName: 'smoke',
    scenarioName: 'quiz-session',
    baseUrl: 'http://127.0.0.1:10000',
  });
  assert.equal(report.verdict.status, 'FAIL');
  assert.equal(report.verdict.passed, false);
  assert.ok(report.thresholdFailures.some((f) => f.status === 'NO_SAMPLES'));
});

test('reporting.js reproduces and blocks legacy zero-sample endpoint false-PASS bug', () => {
  // Mirrors results-stage4-enabled.json where 4803 requests ran, but 0 questions_batch requests fired.
  const partialZeroEndpointData = {
    state: { testRunDurationMs: 60000 },
    metrics: {
      http_reqs: { type: 'counter', values: { count: 4803, rate: 80.05 } },
      http_req_failed: { type: 'rate', values: { rate: 0.001 }, thresholds: { 'rate<0.01': { ok: true } } },
      http_req_duration: {
        type: 'trend',
        values: { avg: 25, min: 4, med: 20, max: 120, 'p(90)': 50, 'p(95)': 60, 'p(99)': 90 },
        thresholds: { 'p(99)<1000': { ok: true } },
      },
      checks: { type: 'rate', values: { passes: 4800, fails: 3, rate: 0.999 }, thresholds: { 'rate>0.99': { ok: true } } },
      'http_req_duration{endpoint:questions_batch}': {
        type: 'trend',
        values: { avg: 0, min: 0, med: 0, max: 0, 'p(90)': 0, 'p(95)': 0, 'p(99)': 0 },
        thresholds: { 'p(95)<200': { ok: true }, 'p(99)<400': { ok: true } },
      },
      questions_batch_requests_total: { type: 'counter', values: { count: 0 } },
      duplicate_questions_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
      answer_key_leaks_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
      failed_answer_submissions_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
      unexpected_auth_failures_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
      unhandled_5xx_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
    },
  };

  const evalRes = evaluateThresholds(partialZeroEndpointData);
  assert.equal(evalRes.allPassed, false);
  assert.equal(evalRes.evaluations['http_req_duration{endpoint:questions_batch}'].status, 'NO_SAMPLES');

  const report = buildSummaryReport(partialZeroEndpointData, {
    envName: 'staging',
    profileName: 'target',
    scenarioName: 'meow-question-delivery',
  });
  assert.equal(report.verdict.status, 'FAIL');
  assert.equal(report.verdict.passed, false);
});

test('reporting.js emits PASS and PASS WITH WARNINGS and formats human summary', () => {
  const baseMetrics = {
    http_reqs: { type: 'counter', values: { count: 200, rate: 20 } },
    http_req_failed: { type: 'rate', values: { rate: 0 }, thresholds: { 'rate<0.01': { ok: true } } },
    http_req_duration: {
      type: 'trend',
      values: { avg: 30, min: 5, med: 25, max: 110, 'p(90)': 55, 'p(95)': 70, 'p(99)': 95 },
      thresholds: { 'p(99)<1000': { ok: true } },
    },
    checks: { type: 'rate', values: { passes: 400, fails: 0, rate: 1 }, thresholds: { 'rate>0.99': { ok: true } } },
    journey_success_rate: { type: 'rate', values: { passes: 50, fails: 0, rate: 1 }, thresholds: { 'rate>0.99': { ok: true } } },
    'http_req_duration{endpoint:questions_batch}': {
      type: 'trend',
      values: { avg: 22, min: 4, med: 20, max: 80, 'p(90)': 40, 'p(95)': 48, 'p(99)': 75 },
      thresholds: { 'p(95)<500': { ok: true } },
    },
    questions_batch_requests_total: { type: 'counter', values: { count: 50 } },
    duplicate_questions_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
    answer_key_leaks_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
    failed_answer_submissions_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
    unexpected_auth_failures_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
    unhandled_5xx_total: { type: 'counter', values: { count: 0 }, thresholds: { 'count==0': { ok: true } } },
    meow_scraped_metrics_available: { type: 'gauge', values: { value: 1 } },
    meow_scraped_cache_hit_ratio: { type: 'gauge', values: { value: 0.92 } },
    meow_scraped_redis_hit_ratio: { type: 'gauge', values: { value: 0.88 } },
    meow_scraped_cache_hits_delta: { type: 'gauge', values: { value: 92 } },
    meow_scraped_cache_misses_delta: { type: 'gauge', values: { value: 8 } },
  };

  const passReport = buildSummaryReport(
    { state: { testRunDurationMs: 10_000 }, metrics: baseMetrics },
    { envName: 'local', profileName: 'smoke', redisMode: 'enabled', scenarioName: 'quiz-session', baseUrl: 'http://127.0.0.1:10000' },
  );
  assert.equal(passReport.verdict.status, 'PASS');
  assert.equal(passReport.verdict.passed, true);

  const warnReport = buildSummaryReport(
    {
      state: { testRunDurationMs: 10_000 },
      metrics: {
        ...baseMetrics,
        meow_scraped_cache_hit_ratio: { type: 'gauge', values: { value: 0.55 } },
      },
    },
    { envName: 'local', profileName: 'smoke', redisMode: 'enabled', scenarioName: 'quiz-session', baseUrl: 'http://127.0.0.1:10000' },
  );
  assert.equal(warnReport.verdict.status, 'PASS WITH WARNINGS');
  assert.equal(warnReport.verdict.passed, true);
  assert.ok(warnReport.warnings.some((w) => w.includes('80.00%')));

  const text = formatHumanSummary(warnReport);
  assert.ok(text.includes('VERDICT: PASS WITH WARNINGS'));
  assert.ok(text.includes('GET /v1/sessions/:id/questions'));

  const parsedProm = parsePrometheusMetrics(
    [
      'meow_cache_operations_total{layer="l1",outcome="hit"} 80',
      'meow_cache_operations_total{layer="redis",outcome="hit"} 15',
      'meow_cache_operations_total{layer="source",outcome="miss"} 5',
      'meow_mongo_pool_waiting 2',
    ].join('\n'),
  );
  const deltas = computePrometheusDeltas(
    { l1Hits: 0, l1Stale: 0, redisHits: 0, redisStale: 0, redisMisses: 0, sourceMisses: 0, bypasses: 0, mongoPoolWaiting: 0, mongoCommandsTotal: 0, redisFallbacksTotal: 0 },
    parsedProm,
  );
  assert.equal(deltas.tieredCacheHitRatio, 0.95);
});

// ============================================================================
// 3. helpers/data.js tests
// ============================================================================
test('data.js generates valid idempotency keys, non-empty meta filters, and catches leaks/duplicates', () => {
  const seenKeys = new Set();
  for (let i = 0; i < 100; i++) {
    const key = makeIdempotencyKey('k6_ans', { vu: 3, iter: i });
    assert.match(key, /^[a-zA-Z0-9_-]{24,96}$/);
    assert.ok(!seenKeys.has(key));
    seenKeys.add(key);
  }

  const metaDefaults = getMetaFilterParams({});
  assert.ok(metaDefaults.subject === 'mathematics' || Boolean(metaDefaults.topic));

  const qFiltersDefault = getQuestionFilterParams({});
  assert.equal(qFiltersDefault.subject, 'mathematics');
  assert.equal(qFiltersDefault.examMode, 'ssc');
  assert.equal('topic' in qFiltersDefault, false);

  const qFiltersWithTopic = getQuestionFilterParams({ topic: 'percentages' });
  assert.equal(qFiltersWithTopic.topic, 'percentages');

  assert.equal(pickWeightedQuizMode('mock'), 'mock');
  assert.ok(['practice', 'topic', 'speed', 'mock'].includes(pickWeightedQuizMode('')));

  const leaks = countAnswerKeyLeaks([
    { questionUid: 'q_1', question: 'ok', options: ['a', 'b'] },
    {
      questionUid: 'q_2',
      correctAnswer: 'a',
      translations: { en: { solution: 'leak' } },
    },
  ]);
  assert.equal(leaks, 2);

  const seenSet = new Set();
  assert.equal(trackUniqueQuestions([{ questionUid: 'q_1' }, { questionUid: 'q_2' }], seenSet), 0);
  assert.equal(trackUniqueQuestions([{ questionUid: 'q_2' }, { questionUid: 'q_3' }], seenSet), 1);

  assert.equal(classifyHttpResponse({ status: 404 }, [404]).category, 'business');
  assert.equal(classifyHttpResponse({ status: 503 }, [404]).isUnhandled5xx, true);
  assert.equal(classifyHttpResponse({ status: 429 }, []).isRateLimited, true);
});

// ============================================================================
// 4. helpers/auth.js tests
// ============================================================================
test('auth.js resolves account pools, decodes JWT exp, and isolates VU refresh sessions', () => {
  resetVuAuthStateForTest();
  k6StubState.postCalls.length = 0;

  const numbered = resolveAuthInputs({
    K6_USER_EMAIL_1: 'u1@example.com',
    K6_USER_PASSWORD_1: 'pw1',
    K6_USER_EMAIL_2: 'u2@example.com',
    K6_USER_PASSWORD_2: 'pw2',
  });
  assert.equal(numbered.accounts.length, 2);

  assert.equal(getTrustedOrigin({ envName: 'local', env: {} }), 'http://localhost:3000');
  assert.equal(
    getTrustedOrigin({ envName: 'staging', baseUrl: 'https://api.stage.example.com', env: { K6_ORIGIN: 'https://app.stage.example.com/' } }),
    'https://app.stage.example.com',
  );

  const expSec = Math.floor((Date.now() + 3600_000) / 1000);
  const freshJwt = makeUnsignedJwt({ id: 'u1', exp: expSec });
  assert.equal(parseJwtExpMs(freshJwt), expSec * 1000);

  // Near-expiry shared setup token triggers isolated VU /auth/login (NOT /auth/refresh on shared cookie)
  const nearExpiryJwt = makeUnsignedJwt({ id: 'u1', exp: Math.floor((Date.now() + 30_000) / 1000) });
  const renewedJwt = makeUnsignedJwt({ id: 'u1', exp: Math.floor((Date.now() + 3600_000) / 1000) });
  const refreshedJwt = makeUnsignedJwt({ id: 'u1', exp: Math.floor((Date.now() + 7200_000) / 1000) });

  k6StubState.postResponder = (url) => {
    if (url.endsWith('/auth/login')) {
      return { status: 200, body: JSON.stringify({ token: renewedJwt }), json: () => ({ token: renewedJwt }), timings: { duration: 5 } };
    }
    if (url.endsWith('/auth/refresh')) {
      return { status: 200, body: JSON.stringify({ token: refreshedJwt }), json: () => ({ token: refreshedJwt }), timings: { duration: 5 } };
    }
    return { status: 404, body: '{}', json: () => ({}), timings: { duration: 5 } };
  };

  const data = {
    tokens: [nearExpiryJwt],
    tokenExps: [parseJwtExpMs(nearExpiryJwt)],
    accounts: [{ email: 'u1@example.com', password: 'secret' }],
    origin: 'http://localhost:3000',
  };
  const config = { baseUrl: 'http://127.0.0.1:10000', envName: 'local', profileName: 'smoke', redisMode: 'enabled' };

  const tok1 = getAuthToken(data, config);
  assert.equal(tok1, renewedJwt);
  assert.equal(k6StubState.postCalls.length, 1);
  assert.ok(k6StubState.postCalls[0].url.endsWith('/auth/login'));

  // Now that the VU owns an isolated vuCookieJar, handleUnauthorized safely uses /auth/refresh with Origin
  const tok2 = handleUnauthorized(data, config);
  assert.equal(tok2, refreshedJwt);
  assert.equal(k6StubState.postCalls.length, 2);
  assert.ok(k6StubState.postCalls[1].url.endsWith('/auth/refresh'));
  assert.equal(k6StubState.postCalls[1].params.headers.Origin, 'http://localhost:3000');

  k6StubState.postResponder = null;
  resetVuAuthStateForTest();
});

// ============================================================================
// 5. scripts/staging-test-data.mjs guardrails & MongoMemoryServer roundtrip
// ============================================================================
test('staging-test-data.mjs blocks production targets and redacts MongoDB URI credentials', () => {
  assert.throws(
    () => assertSafeDatabaseTarget({ envName: 'production', uri: 'mongodb://127.0.0.1:27017/quizDB', dbName: 'quizDB' }),
    /production/i,
  );
  assert.throws(
    () => assertSafeDatabaseTarget({ envName: 'local', uri: 'mongodb+srv://cluster.mongodb.net/meow', dbName: 'meow' }),
    /standard mongodb:\/\//i,
  );
  assert.throws(
    () => assertSafeDatabaseTarget({ envName: 'local', uri: 'mongodb://remote-host.internal:27017/meow', dbName: 'meow' }),
    /loopback/i,
  );
  assert.throws(
    () =>
      assertSafeDatabaseTarget({
        envName: 'staging',
        uri: 'mongodb+srv://u:p@quizguru-staging.c8bkump.mongodb.net/quizDB_staging',
        dbName: 'quizDB_staging',
        allowStaging: false,
      }),
    /explicit approval/i,
  );
  assert.throws(
    () =>
      assertSafeDatabaseTarget({
        envName: 'staging',
        uri: 'mongodb+srv://u:p@quizguru-staging.c8bkump.mongodb.net/quizDB',
        dbName: 'quizDB',
        allowStaging: true,
      }),
    /containing "staging"/i,
  );
  assert.throws(
    () =>
      assertSafeDatabaseTarget({
        envName: 'staging',
        uri: 'mongodb+srv://u:p@quizguru-prod.c8bkump.mongodb.net/quizDB_staging',
        dbName: 'quizDB_staging',
        allowStaging: true,
      }),
    /production-looking/i,
  );
  assert.throws(
    () =>
      assertSafeDatabaseTarget({
        envName: 'staging',
        uri: 'mongodb+srv://u:p@other.c8bkump.mongodb.net/quizDB_staging',
        dbName: 'quizDB_staging',
        allowStaging: true,
        expectedHost: 'quizguru-staging.c8bkump.mongodb.net',
      }),
    /STAGING_MONGODB_EXPECTED_HOST/,
  );

  assert.equal(
    stripMongoUriCredentials('mongodb+srv://admin:supersecret@cluster.mongodb.net/quizDB_staging'),
    'mongodb+srv://***@cluster.mongodb.net/quizDB_staging',
  );

  const cli = parseCliArgs(['setup', '--env', 'staging', '--allow-staging', '--count', '25', '--json']);
  assert.equal(cli.command, 'setup');
  assert.equal(cli.env, 'staging');
  assert.equal(cli.allowStaging, true);
  assert.equal(cli.count, 25);
  assert.equal(cli.json, true);
});

test('staging-test-data.mjs setup -> seed -> status -> cleanup roundtrip against MongoMemoryServer', async () => {
  const mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  const client = new MongoClient(uri);
  await client.connect();

  try {
    const db = client.db('quizDB_staging_test');
    const target = assertSafeDatabaseTarget({ envName: 'local', uri, dbName: 'quizDB_staging_test' });
    assert.equal(target.envName, 'local');

    // 1. Setup: 3 synthetic users + 50 synthetic questions
    const setupRes = await runSetup(db, {
      prefix: 'k6-m3',
      count: 3,
      password: 'TestPassword123!',
      seedQuestions: true,
      questionCount: 50,
      bcryptCost: 6,
    });
    assert.equal(setupRes.usersCreated, 3);
    assert.equal(setupRes.questionsSeeded, 50);

    const users = await db.collection('users').find({ k6Prefix: 'k6-m3' }).toArray();
    assert.equal(users.length, 3);
    for (const u of users) {
      assert.equal(u.accountRecord, true);
      assert.equal(u.emailNormalized, u.email);
      assert.equal(u.emailVerified, true);
      assert.equal(u.historyStorageVersion, 1);
      assert.equal(u.role, 'student');
      assert.equal(u.authProvider, 'local');
      assert.equal(await bcrypt.compare('TestPassword123!', u.passwordHash), true);
    }

    const questions = await db.collection('questions').find({ k6Prefix: 'k6-m3' }).toArray();
    assert.equal(questions.length, 50);
    for (const q of questions) {
      assert.match(q.questionUid, /^q_[a-f0-9]{32}$/);
      assert.equal(q.keyVersion, 1);
      assert.ok(q.topicKey);
      assert.ok(q.subjectKey);
      assert.ok(q.modeKey);
      assert.equal(q.examModeKey, 'ssc');
      assert.match(q.selectionKey, /^[a-f0-9]{16}$/);
      assert.equal(q.letter, undefined);
      assert.equal(q.word, undefined);
    }

    // Seed synthetic user-scoped state across all 8+ collections including idempotencyRecords
    const uid = users[0].id;
    const sessionId = 'qs_test_session_1';
    const submissionId = 'k6_ans_0_1_1_abc1234567890';
    const expectedIdempId = createHash('sha256')
      .update(`${uid}:v1.quiz.session.answer:${sessionId}:${submissionId}`)
      .digest('hex');

    assert.deepEqual(
      computeAnswerIdempotencyIds([{ userId: uid, sessionId, answers: { q1: { submissionId } } }]),
      [expectedIdempId],
    );

    await db.collection('authSessions').insertOne({ _id: 'sid_1', userId: uid });
    await db.collection('quizSessions').insertOne({
      sessionId,
      userId: uid,
      answers: { [questions[0].questionUid]: { submissionId } },
    });
    await db.collection('idempotencyRecords').insertOne({ _id: expectedIdempId, status: 'completed' });
    await db.collection('userQuestionProgress').insertOne({ userId: uid, questionUid: questions[0].questionUid });
    await db.collection('userTopicProgress').insertOne({ userId: uid, topic: 'percentages' });
    await db.collection('userAnalytics').insertOne({ userId: uid });
    await db.collection('studyActivityDaily').insertOne({ userId: uid, dateKey: '2026-11-22' });
    await db.collection('userQuizHistory').insertOne({ userId: uid });
    await db.collection('aiConversations').insertOne({ userId: uid });
    await db.collection('userBookmarks').insertOne({ userId: uid });
    await db.collection('aiMessages').insertOne({ userId: uid });

    const statusBefore = await runStatus(db, { prefix: 'k6-m3' });
    assert.equal(statusBefore.syntheticUsers, 3);
    assert.equal(statusBefore.collections.quizSessions, 1);
    assert.equal(statusBefore.questions.syntheticForPrefix, 50);

    // 2. Cleanup users & user-scoped state (preserving questions)
    const cleanupUsersRes = await runCleanup(db, { prefix: 'k6-m3', includeQuestions: false });
    assert.equal(cleanupUsersRes.deleted.users, 3);
    assert.equal(cleanupUsersRes.deleted.idempotencyRecords, 1);
    assert.equal(cleanupUsersRes.deleted.quizSessions, 1);
    assert.equal(cleanupUsersRes.deleted.authSessions, 1);
    assert.equal(cleanupUsersRes.deleted.userQuestionProgress, 1);
    assert.equal(cleanupUsersRes.deleted.userTopicProgress, 1);
    assert.equal(cleanupUsersRes.deleted.userAnalytics, 1);
    assert.equal(cleanupUsersRes.deleted.studyActivityDaily, 1);
    assert.equal(cleanupUsersRes.deleted.userQuizHistory, 1);
    assert.equal(cleanupUsersRes.deleted.aiConversations, 1);
    assert.equal(cleanupUsersRes.deleted.userBookmarks, 1);
    assert.equal(cleanupUsersRes.deleted.aiMessages, 1);
    assert.equal(cleanupUsersRes.deleted.questions, 0);

    assert.equal(await db.collection('idempotencyRecords').countDocuments({ _id: expectedIdempId }), 0);
    assert.equal(await db.collection('questions').countDocuments({ k6Prefix: 'k6-m3' }), 50);

    // 3. Re-seed and cleanup with includeQuestions: true
    const seedRes = await runSeed(db, {
      prefix: 'k6-m3',
      count: 2,
      password: 'TestPassword123!',
      seedQuestions: false,
      questionCount: 0,
      bcryptCost: 6,
    });
    assert.equal(seedRes.usersUpserted, 2);

    const revBefore = (await db.collection('questionMetadata').findOne({ _id: 'revision' }))?.revision || 0;
    const fullCleanup = await runCleanup(db, { prefix: 'k6-m3', includeQuestions: true });
    assert.equal(fullCleanup.deleted.users, 2);
    assert.equal(fullCleanup.deleted.questions, 50);
    const revAfter = (await db.collection('questionMetadata').findOne({ _id: 'revision' }))?.revision || 0;
    assert.equal(revAfter, revBefore + 1);
  } finally {
    await client.close();
    await mongod.stop();
  }
});

test('staging-test-data.mjs builders produce schema-compliant docs directly', () => {
  const user = buildSyntheticUserDoc({ index: 7, prefix: 'K6_Test', passwordHash: '$2a$10$hash' });
  assert.equal(user.id, 'k6_test-7');
  assert.equal(user.email, 'k6_test-7@loadtest.invalid');
  assert.equal(user.emailNormalized, user.email);

  const q = buildSyntheticQuestionDoc({ index: 1, prefix: 'k6-test' });
  const norm = buildNormalizedQuestionFields(q);
  assert.equal(norm.keyVersion, 1);
  assert.equal(q.topicKey, norm.topicKey);
  assert.equal(q.selectionKey, norm.selectionKey);
});
