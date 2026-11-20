import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Counter, Gauge, Rate, Trend } from 'k6/metrics';
import exec from 'k6/execution';

// ============================================================================
// Meow Question Delivery — Production k6 Load-Test Suite (Stages 1–6 + Ramp)
// ============================================================================
// Simulates realistic concurrent quiz-taker traffic against `/api/v1/quiz/*`
// alongside a secondary read-only legacy compatibility scenario against
// `/api/questions/session` + `/api/questions/meta`.
//
// Usage:
//   k6 run -e BASE_URL=https://staging.example.com \
//          -e STAGE=stage4 \
//          -e REDIS_MODE=enabled \
//          -e TEST_EMAIL=load@example.com \
//          -e TEST_PASSWORD=secret \
//          -e METRICS_TOKEN=... \
//          load-tests/k6/meow-question-delivery.js

const BASE_URL = String(__ENV.BASE_URL || 'http://127.0.0.1:10000').replace(/\/+$/, '');
const STAGE = String(__ENV.STAGE || 'stage4').trim().toLowerCase();
const REDIS_MODE = String(__ENV.REDIS_MODE || 'enabled').trim().toLowerCase() === 'disabled'
  ? 'disabled'
  : 'enabled';
const EXAM_MODE = String(__ENV.EXAM_MODE || '').trim();
const TOPIC = String(__ENV.TOPIC || '').trim();
const SUBJECT = String(__ENV.SUBJECT || '').trim();
const BATCH_SIZE = clampInt(__ENV.BATCH_SIZE, 20, 1, 50);
const LEGACY_LIMIT = clampInt(__ENV.LEGACY_LIMIT, 25, 1, 50);
const THINK_TIME_SCALE = clampFloat(__ENV.THINK_TIME_SCALE, 1.0, 0, 5);
const METRICS_TOKEN = String(__ENV.METRICS_TOKEN || '').trim();
const LEGACY_ENABLED = String(__ENV.LEGACY_ENABLED || 'true').trim().toLowerCase() !== 'false';
const LEGACY_RATIO = LEGACY_ENABLED ? clampFloat(__ENV.LEGACY_RATIO, 0.15, 0.05, 0.5) : 0;
const SUMMARY_OUTPUT = String(
  __ENV.SUMMARY_OUTPUT || `load-tests/k6/results-${STAGE}-${REDIS_MODE}.json`,
).trim();

// Weighted quiz mode mix reflecting production usage.
const MODE_WEIGHTS = [
  { mode: 'practice', weight: 40 },
  { mode: 'topic', weight: 30 },
  { mode: 'speed', weight: 15 },
  { mode: 'mock', weight: 15 },
];
const TOTAL_MODE_WEIGHT = MODE_WEIGHTS.reduce((sum, item) => sum + item.weight, 0);

// Forbidden answer-key fields that must NEVER appear in question delivery responses.
const FORBIDDEN_FIELD_PATTERNS = [
  /^correct([A-Z_].*|$)/i,
  /^solution([A-Z_].*|$)/i,
  /^explanation([A-Z_].*|$)/i,
  /^answer(_?key)?$/i,
];

// ============================================================================
// Stage Profiles (Stages 1–6 + Full Staged Ramp)
// ============================================================================
const STAGE_PROFILES = {
  stage1: {
    label: 'Stage 1 — Baseline (50 VUs)',
    peakVus: 50,
    stages: [
      { duration: '20s', target: 50 },
      { duration: '2m', target: 50 },
      { duration: '20s', target: 0 },
    ],
  },
  stage2: {
    label: 'Stage 2 — Cache & DB Validation (100 VUs)',
    peakVus: 100,
    stages: [
      { duration: '30s', target: 100 },
      { duration: '3m', target: 100 },
      { duration: '20s', target: 0 },
    ],
  },
  stage3: {
    label: 'Stage 3 — Bottleneck Discovery (250 VUs)',
    peakVus: 250,
    stages: [
      { duration: '45s', target: 250 },
      { duration: '3m', target: 250 },
      { duration: '30s', target: 0 },
    ],
  },
  stage4: {
    label: 'Stage 4 — Production Target (500 VUs)',
    peakVus: 500,
    stages: [
      { duration: '1m', target: 500 },
      { duration: '4m', target: 500 },
      { duration: '30s', target: 0 },
    ],
  },
  stage5: {
    label: 'Stage 5 — Headroom / Stress (750 VUs)',
    peakVus: 750,
    stages: [
      { duration: '1m30s', target: 750 },
      { duration: '4m', target: 750 },
      { duration: '45s', target: 0 },
    ],
  },
  stage6: {
    label: 'Stage 6 — Capacity Boundary (1000 VUs)',
    peakVus: 1000,
    stages: [
      { duration: '2m', target: 1000 },
      { duration: '4m', target: 1000 },
      { duration: '45s', target: 0 },
    ],
  },
  ramp: {
    label: 'Full Staged Ramp (50 -> 100 -> 250 -> 500 -> 750 -> 1000 VUs)',
    peakVus: 1000,
    stages: [
      { duration: '30s', target: 50 },
      { duration: '1m30s', target: 50 },
      { duration: '30s', target: 100 },
      { duration: '2m', target: 100 },
      { duration: '45s', target: 250 },
      { duration: '2m', target: 250 },
      { duration: '1m', target: 500 },
      { duration: '3m', target: 500 },
      { duration: '1m', target: 750 },
      { duration: '2m', target: 750 },
      { duration: '1m', target: 1000 },
      { duration: '2m', target: 1000 },
      { duration: '45s', target: 0 },
    ],
  },
};

const ACTIVE_PROFILE = STAGE_PROFILES[STAGE];
if (!ACTIVE_PROFILE) {
  throw new Error(
    `Unknown STAGE="${STAGE}". Expected one of: ${Object.keys(STAGE_PROFILES).join(', ')}`,
  );
}

function splitStages(stages, fraction, ensureAtLeastOne) {
  return stages.map((step) => {
    if (step.target === 0) return { duration: step.duration, target: 0 };
    const raw = Math.round(step.target * fraction);
    const target = ensureAtLeastOne ? Math.max(1, raw) : Math.max(0, raw);
    return { duration: step.duration, target };
  });
}

function buildScenarios() {
  const primaryFraction = LEGACY_ENABLED ? 1 - LEGACY_RATIO : 1;
  const scenarios = {
    quiz_taker_journey: {
      executor: 'ramping-vus',
      exec: 'quizTakerJourney',
      startVUs: 0,
      stages: splitStages(ACTIVE_PROFILE.stages, primaryFraction, true),
      gracefulRampDown: '30s',
      tags: { scenario_role: 'v1_quiz_journey', redis_mode: REDIS_MODE, stage: STAGE },
    },
  };

  if (LEGACY_ENABLED) {
    scenarios.legacy_readonly_compat = {
      executor: 'ramping-vus',
      exec: 'legacyReadOnlyJourney',
      startVUs: 0,
      stages: splitStages(ACTIVE_PROFILE.stages, LEGACY_RATIO, true),
      gracefulRampDown: '20s',
      tags: { scenario_role: 'legacy_readonly', redis_mode: REDIS_MODE, stage: STAGE },
    };
  }

  return scenarios;
}

// ============================================================================
// Custom Metrics & SLO Thresholds
// ============================================================================
const duplicateQuestionsTotal = new Counter('duplicate_questions_total');
const answerKeyLeaksTotal = new Counter('answer_key_leaks_total');
const failedAnswerSubmissionsTotal = new Counter('failed_answer_submissions_total');
const sessionsCompletedTotal = new Counter('sessions_completed_total');
const answersSubmittedTotal = new Counter('answers_submitted_total');
const prefetchBatchesTotal = new Counter('prefetch_batches_total');
const idempotentReplaysVerified = new Counter('idempotent_replays_verified_total');

const sessionCreateDurationMs = new Trend('session_create_duration_ms', true);
const questionsBatchDurationMs = new Trend('questions_batch_duration_ms', true);
const answerSubmitDurationMs = new Trend('answer_submit_duration_ms', true);
const sessionSubmitDurationMs = new Trend('session_submit_duration_ms', true);
const sessionResultDurationMs = new Trend('session_result_duration_ms', true);
const legacySessionDurationMs = new Trend('legacy_session_duration_ms', true);
const legacyMetaDurationMs = new Trend('legacy_meta_duration_ms', true);
const questionsBatchPayloadBytes = new Trend('questions_batch_payload_bytes');

const journeySuccessRate = new Rate('journey_success_rate');

// Prometheus `/metrics` scrape gauges populated in setup() / teardown().
const scrapedMetricsAvailable = new Gauge('meow_scraped_metrics_available');
const scrapedCacheHitRatio = new Gauge('meow_scraped_cache_hit_ratio');
const scrapedRedisHitRatio = new Gauge('meow_scraped_redis_hit_ratio');
const scrapedCacheHitsDelta = new Gauge('meow_scraped_cache_hits_delta');
const scrapedCacheMissesDelta = new Gauge('meow_scraped_cache_misses_delta');
const scrapedRedisHitsDelta = new Gauge('meow_scraped_redis_hits_delta');
const scrapedRedisMissesDelta = new Gauge('meow_scraped_redis_misses_delta');
const scrapedMongoPoolWaitingBefore = new Gauge('meow_scraped_mongo_pool_waiting_before');
const scrapedMongoPoolWaitingAfter = new Gauge('meow_scraped_mongo_pool_waiting_after');
const scrapedMongoCommandsDelta = new Gauge('meow_scraped_mongo_commands_delta');
const scrapedRedisFallbacksDelta = new Gauge('meow_scraped_redis_fallbacks_delta');

export const options = {
  scenarios: buildScenarios(),
  tags: {
    redis_mode: REDIS_MODE,
    stage: STAGE,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    'http_req_duration{endpoint:questions_batch}': ['p(95)<200', 'p(99)<400'],
    'http_req_duration{endpoint:session_create}': ['p(95)<250'],
    http_req_failed: ['rate<0.001'],
    duplicate_questions_total: ['count==0'],
    answer_key_leaks_total: ['count==0'],
    failed_answer_submissions_total: ['count==0'],
  },
};

// ============================================================================
// Helpers
// ============================================================================
function clampInt(raw, fallback, min, max) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function clampFloat(raw, fallback, min, max) {
  const n = Number.parseFloat(String(raw ?? ''));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function thinkPause(minSec, maxSec) {
  if (THINK_TIME_SCALE <= 0) return;
  sleep(randomBetween(minSec, maxSec) * THINK_TIME_SCALE);
}

function pickMode() {
  let cursor = Math.random() * TOTAL_MODE_WEIGHT;
  for (const item of MODE_WEIGHTS) {
    cursor -= item.weight;
    if (cursor <= 0) return item.mode;
  }
  return 'practice';
}

function safeJson(res) {
  try {
    return res.json();
  } catch {
    return null;
  }
}

function buildQueryString(params) {
  const parts = [];
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value).trim())}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

function makeIdempotencyKey(prefix) {
  const vu = exec.vu.idInTest || 0;
  const iter = exec.vu.iterationInScenario || 0;
  const rnd = Math.floor(Math.random() * 1e9).toString(36).padStart(6, '0');
  const ts = Date.now().toString(36);
  // Matches both middleware/idempotency.js (/^[a-zA-Z0-9_-]{8,128}$/) and contracts/quiz-session.js.
  return `${prefix}_${vu}_${iter}_${ts}_${rnd}`.slice(0, 120);
}

function isForbiddenKey(key) {
  return FORBIDDEN_FIELD_PATTERNS.some((pattern) => pattern.test(key));
}

function countAnswerKeyLeaks(questions) {
  if (!Array.isArray(questions)) return 0;
  let leaks = 0;
  for (const q of questions) {
    if (!q || typeof q !== 'object') continue;
    for (const key of Object.keys(q)) {
      if (isForbiddenKey(key) && q[key] !== undefined) {
        leaks++;
      }
    }
    if (q.translations && typeof q.translations === 'object' && !Array.isArray(q.translations)) {
      for (const langObj of Object.values(q.translations)) {
        if (!langObj || typeof langObj !== 'object' || Array.isArray(langObj)) continue;
        for (const key of Object.keys(langObj)) {
          if (isForbiddenKey(key) && langObj[key] !== undefined) {
            leaks++;
          }
        }
      }
    }
  }
  return leaks;
}

function trackQuestionsAndDetectDuplicates(questions, seenUids) {
  if (!Array.isArray(questions)) return 0;
  let duplicates = 0;
  for (const q of questions) {
    if (!q || typeof q !== 'object') continue;
    const uid = String(q.questionUid || q.id || q.sessionAnchor || '').trim();
    if (!uid) continue;
    if (seenUids.has(uid)) {
      duplicates++;
    } else {
      seenUids.add(uid);
    }
  }
  return duplicates;
}

function chooseAnswerForQuestion(question) {
  if (Array.isArray(question?.options) && question.options.length > 0) {
    return Math.floor(Math.random() * question.options.length);
  }
  return 0;
}

function authHeaders(token, extra = {}) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...extra,
  };
}

// ============================================================================
// Prometheus `/metrics` Scraper & Parser
// ============================================================================
function parseMetricLabels(rawLabels) {
  const labels = {};
  if (!rawLabels) return labels;
  const regex = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = regex.exec(rawLabels)) !== null) {
    labels[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return labels;
}

function parsePrometheusMetrics(text) {
  const summary = {
    l1Hits: 0,
    l1Stale: 0,
    l1Misses: 0,
    redisHits: 0,
    redisStale: 0,
    redisMisses: 0,
    sourceMisses: 0,
    bypasses: 0,
    cacheErrors: 0,
    mongoPoolWaiting: 0,
    mongoCommandsTotal: 0,
    redisFallbacksTotal: 0,
  };

  for (const line of String(text || '').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|NaN|\+Inf|-Inf)/.exec(
      trimmed,
    );
    if (!match) continue;
    const [, name, rawLabels, rawValue] = match;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) continue;

    if (name === 'meow_cache_operations_total') {
      const labels = parseMetricLabels(rawLabels);
      const layer = labels.layer;
      const outcome = labels.outcome;
      if (outcome === 'error') {
        summary.cacheErrors += value;
      } else if (outcome === 'bypass') {
        summary.bypasses += value;
      } else if (layer === 'l1') {
        if (outcome === 'hit') summary.l1Hits += value;
        else if (outcome === 'stale') summary.l1Stale += value;
        else if (outcome === 'miss') summary.l1Misses += value;
      } else if (layer === 'redis') {
        if (outcome === 'hit') summary.redisHits += value;
        else if (outcome === 'stale') summary.redisStale += value;
        else if (outcome === 'miss') summary.redisMisses += value;
      } else if (layer === 'source' && outcome === 'miss') {
        summary.sourceMisses += value;
      }
    } else if (name === 'meow_mongo_pool_waiting') {
      summary.mongoPoolWaiting = value;
    } else if (name === 'meow_mongo_commands_total') {
      summary.mongoCommandsTotal += value;
    } else if (name === 'meow_redis_fallback_total') {
      summary.redisFallbacksTotal += value;
    }
  }

  return summary;
}

function scrapePrometheusMetrics(phase) {
  if (!METRICS_TOKEN) return null;
  const res = http.get(`${BASE_URL}/metrics`, {
    headers: { Authorization: `Bearer ${METRICS_TOKEN}` },
    tags: { endpoint: 'metrics_scrape', phase, redis_mode: REDIS_MODE, stage: STAGE },
    responseCallback: http.expectedStatuses(200),
  });
  if (res.status !== 200) {
    console.warn(`[k6][metrics] GET /metrics (${phase}) returned HTTP ${res.status}`);
    return null;
  }
  return parsePrometheusMetrics(res.body);
}

// ============================================================================
// Setup & Teardown (Auth Token Bootstrap + Before/After `/metrics` Scrape)
// ============================================================================
function loginAccount(email, password) {
  const res = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { endpoint: 'auth_login', redis_mode: REDIS_MODE, stage: STAGE },
    },
  );
  const body = safeJson(res);
  if (res.status !== 200 || !body?.token) {
    throw new Error(
      `Failed to authenticate TEST_EMAIL=${email} via POST /auth/login (HTTP ${res.status}): ${res.body}`,
    );
  }
  return body.token;
}

function resolveAuthTokens() {
  if (__ENV.AUTH_TOKENS) {
    const parsed = String(__ENV.AUTH_TOKENS)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (parsed.length > 0) return { tokens: parsed, accounts: [] };
  }

  if (__ENV.AUTH_TOKEN && String(__ENV.AUTH_TOKEN).trim()) {
    return { tokens: [String(__ENV.AUTH_TOKEN).trim()], accounts: [] };
  }

  if (__ENV.TEST_ACCOUNTS_JSON) {
    let accounts;
    try {
      accounts = JSON.parse(__ENV.TEST_ACCOUNTS_JSON);
    } catch (err) {
      throw new Error(`Invalid TEST_ACCOUNTS_JSON: ${err.message}`);
    }
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error('TEST_ACCOUNTS_JSON must be a non-empty JSON array of { email, password }');
    }
    const tokens = accounts.map((acc) => loginAccount(acc.email, acc.password));
    return { tokens, accounts };
  }

  const email = String(__ENV.TEST_EMAIL || '').trim();
  const password = String(__ENV.TEST_PASSWORD || '').trim();
  if (email && password) {
    const token = loginAccount(email, password);
    return { tokens: [token], accounts: [{ email, password }] };
  }

  throw new Error(
    'Authentication required: provide AUTH_TOKEN (or AUTH_TOKENS) or TEST_EMAIL + TEST_PASSWORD (or TEST_ACCOUNTS_JSON).',
  );
}

export function setup() {
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { endpoint: 'health_check', redis_mode: REDIS_MODE, stage: STAGE },
  });
  check(healthRes, {
    'setup: /api/health returns 200': (r) => r.status === 200,
  });

  const auth = resolveAuthTokens();
  const beforeMetrics = scrapePrometheusMetrics('before');

  if (beforeMetrics) {
    scrapedMetricsAvailable.add(1);
    scrapedMongoPoolWaitingBefore.add(beforeMetrics.mongoPoolWaiting);
  } else {
    scrapedMetricsAvailable.add(0);
  }

  return {
    tokens: auth.tokens,
    accounts: auth.accounts,
    beforeMetrics,
    startedAt: new Date().toISOString(),
  };
}

export function teardown(data) {
  if (!data?.beforeMetrics) return;
  const afterMetrics = scrapePrometheusMetrics('after');
  if (!afterMetrics) return;

  const before = data.beforeMetrics;
  const delta = (key) => Math.max(0, (afterMetrics[key] || 0) - (before[key] || 0));

  const l1Hits = delta('l1Hits') + delta('l1Stale');
  const redisHits = delta('redisHits') + delta('redisStale');
  const redisMisses = delta('redisMisses');
  const sourceMisses = delta('sourceMisses');
  const bypasses = delta('bypasses');

  const totalHits = l1Hits + redisHits;
  const totalReads = totalHits + sourceMisses + bypasses;
  const tieredHitRatio = totalReads > 0 ? totalHits / totalReads : 0;

  const redisLookups = redisHits + redisMisses;
  const redisOnlyHitRatio = redisLookups > 0 ? redisHits / redisLookups : 0;

  scrapedMetricsAvailable.add(1);
  scrapedCacheHitRatio.add(tieredHitRatio);
  scrapedRedisHitRatio.add(redisOnlyHitRatio);
  scrapedCacheHitsDelta.add(totalHits);
  scrapedCacheMissesDelta.add(sourceMisses + bypasses);
  scrapedRedisHitsDelta.add(redisHits);
  scrapedRedisMissesDelta.add(redisMisses);
  scrapedMongoPoolWaitingBefore.add(before.mongoPoolWaiting);
  scrapedMongoPoolWaitingAfter.add(afterMetrics.mongoPoolWaiting);
  scrapedMongoCommandsDelta.add(delta('mongoCommandsTotal'));
  scrapedRedisFallbacksDelta.add(delta('redisFallbacksTotal'));
}

// Per-VU cached token (supports transparent re-login if a long ramp expires a JWT).
let vuToken = null;

function getVuToken(data) {
  if (vuToken) return vuToken;
  const idx = (exec.vu.idInTest - 1) % data.tokens.length;
  vuToken = data.tokens[idx];
  return vuToken;
}

function refreshVuTokenIfPossible(data) {
  if (!data?.accounts?.length) return null;
  const idx = (exec.vu.idInTest - 1) % data.accounts.length;
  const acc = data.accounts[idx];
  if (!acc?.email || !acc?.password) return null;
  try {
    vuToken = loginAccount(acc.email, acc.password);
    return vuToken;
  } catch {
    return null;
  }
}

// ============================================================================
// Primary Scenario: Realistic Concurrent Quiz-Taker Journey (`/api/v1/quiz/*`)
// ============================================================================
export function quizTakerJourney(data) {
  let token = getVuToken(data);
  const mode = pickMode();
  const isExamStyle = mode === 'mock' || mode === 'speed';
  const seenUids = new Set();
  let journeyOk = true;

  // 1. Create session (mix of practice / topic / speed / mock, batchSize=20)
  const createPayload = {
    mode,
    batchSize: BATCH_SIZE,
    totalQuestions: Math.max(BATCH_SIZE * 2, 40),
    lang: 'en',
    randomize: true,
  };
  if (EXAM_MODE) createPayload.examMode = EXAM_MODE;
  if (TOPIC) createPayload.topic = TOPIC;
  if (SUBJECT) createPayload.subject = SUBJECT;

  let sessionId = null;
  let batch1 = [];
  let nextCursor = null;
  let hasMore = false;

  group('01_session_create', () => {
    const createKey = makeIdempotencyKey('k6_create');
    let res = http.post(
      `${BASE_URL}/api/v1/quiz/sessions`,
      JSON.stringify(createPayload),
      {
        headers: authHeaders(token, { 'Idempotency-Key': createKey }),
        tags: { endpoint: 'session_create', mode, redis_mode: REDIS_MODE, stage: STAGE },
      },
    );

    // Handle token expiry transparently during long ramp runs when credentials exist.
    if (res.status === 401) {
      const refreshed = refreshVuTokenIfPossible(data);
      if (refreshed) {
        token = refreshed;
        res = http.post(
          `${BASE_URL}/api/v1/quiz/sessions`,
          JSON.stringify(createPayload),
          {
            headers: authHeaders(token, { 'Idempotency-Key': makeIdempotencyKey('k6_create') }),
            tags: { endpoint: 'session_create', mode, redis_mode: REDIS_MODE, stage: STAGE },
          },
        );
      }
    }

    sessionCreateDurationMs.add(res.timings.duration, { mode, redis_mode: REDIS_MODE });

    const body = safeJson(res);
    const createdOk = check(res, {
      'session create status is 201': (r) => r.status === 201,
      'session create returns sessionId': () => Boolean(body?.sessionId),
      'session create returns questions array': () => Array.isArray(body?.questions),
    });

    if (!createdOk || !body?.sessionId) {
      journeyOk = false;
      return;
    }

    sessionId = body.sessionId;
    batch1 = Array.isArray(body.questions) ? body.questions : [];
    nextCursor = body.nextCursor || null;
    hasMore = Boolean(body.hasMore);

    // Validate zero answer-key leakage and zero duplicates on batch 1.
    const leaks = countAnswerKeyLeaks(batch1);
    if (leaks > 0) {
      answerKeyLeaksTotal.add(leaks, { endpoint: 'session_create', mode });
      journeyOk = false;
    }
    const dups = trackQuestionsAndDetectDuplicates(batch1, seenUids);
    if (dups > 0) {
      duplicateQuestionsTotal.add(dups, { endpoint: 'session_create', mode });
      journeyOk = false;
    }

    check(body, {
      'batch 1 has zero answer-key leaks': () => leaks === 0,
      'batch 1 has zero duplicate questions': () => dups === 0,
    });
  });

  if (!sessionId || batch1.length === 0) {
    journeySuccessRate.add(false);
    thinkPause(0.5, 1.5);
    return;
  }

  // 2. Answer questions with realistic think pace + prefetch Batch 2 around Q15
  const activeQuestions = batch1.slice();
  const prefetchTriggerIndex = Math.min(14, Math.max(0, batch1.length - 1));
  let prefetched = false;

  // Answer through all of batch 1 plus 3 questions from batch 2 once prefetched
  // (emulates seamless cross-batch progression without starving VU throughput).
  const maxAnswersToSubmit = batch1.length + 3;

  group('02_answer_and_prefetch', () => {
    for (let idx = 0; idx < activeQuestions.length && idx < maxAnswersToSubmit; idx++) {
      const q = activeQuestions[idx];
      if (!q?.questionUid) continue;

      // Simulate realistic reading & thinking time before answering.
      thinkPause(0.25, 0.75);

      const submissionId = makeIdempotencyKey(`k6_ans_${idx}`);
      const answerChoice = chooseAnswerForQuestion(q);
      const timeTakenMs = Math.round(randomBetween(1200, 6500));
      const answerPayload = JSON.stringify({
        questionUid: q.questionUid,
        answer: answerChoice,
        timeTakenMs,
        submissionId,
      });

      const ansRes = http.post(
        `${BASE_URL}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/answers`,
        answerPayload,
        {
          headers: authHeaders(token, { 'Idempotency-Key': submissionId }),
          tags: { endpoint: 'answer_submit', mode, redis_mode: REDIS_MODE, stage: STAGE },
        },
      );
      answerSubmitDurationMs.add(ansRes.timings.duration, { mode, redis_mode: REDIS_MODE });

      const ansBody = safeJson(ansRes);
      const accepted = ansRes.status === 200 && ansBody?.accepted === true;

      if (!accepted) {
        failedAnswerSubmissionsTotal.add(1, { mode, status: String(ansRes.status) });
        journeyOk = false;
      } else {
        answersSubmittedTotal.add(1, { mode });
      }

      // In exam-style modes (mock / speed), answers must NEVER reveal evaluation before submit.
      if (accepted && isExamStyle && ansBody?.evaluation !== undefined) {
        answerKeyLeaksTotal.add(1, { endpoint: 'answer_submit', mode });
        journeyOk = false;
      }

      check(ansRes, {
        'answer submit status is 200 & accepted': () => accepted,
        'exam mode does not leak evaluation pre-submit': () =>
          !isExamStyle || ansBody?.evaluation === undefined,
      });

      // Exercise idempotent retry on 5% of Q1 answers to verify duplicate-submission safety.
      if (idx === 0 && accepted && Math.random() < 0.05) {
        const replayRes = http.post(
          `${BASE_URL}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/answers`,
          answerPayload,
          {
            headers: authHeaders(token, { 'Idempotency-Key': submissionId }),
            tags: { endpoint: 'answer_submit_replay', mode, redis_mode: REDIS_MODE, stage: STAGE },
          },
        );
        const replayBody = safeJson(replayRes);
        if (replayRes.status === 200 && replayBody?.accepted === true) {
          idempotentReplaysVerified.add(1);
        } else {
          failedAnswerSubmissionsTotal.add(1, { mode, status: String(replayRes.status) });
          journeyOk = false;
        }
      }

      // Prefetch Batch 2 around Q15 (index 14) while user is mid-session.
      if (!prefetched && idx >= prefetchTriggerIndex && hasMore && nextCursor) {
        prefetched = true;
        const batchQuery = buildQueryString({
          cursor: nextCursor,
          batchSize: BATCH_SIZE,
          lang: 'en',
        });
        const batchRes = http.get(
          `${BASE_URL}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/questions${batchQuery}`,
          {
            headers: authHeaders(token),
            tags: { endpoint: 'questions_batch', mode, redis_mode: REDIS_MODE, stage: STAGE },
          },
        );
        questionsBatchDurationMs.add(batchRes.timings.duration, { mode, redis_mode: REDIS_MODE });
        questionsBatchPayloadBytes.add(batchRes.body ? batchRes.body.length : 0, { mode });

        const batchBody = safeJson(batchRes);
        const batchOk = check(batchRes, {
          'prefetch batch status is 200': (r) => r.status === 200,
          'prefetch batch returns questions array': () => Array.isArray(batchBody?.questions),
        });

        if (batchOk && Array.isArray(batchBody.questions)) {
          prefetchBatchesTotal.add(1, { mode });
          const leaks = countAnswerKeyLeaks(batchBody.questions);
          if (leaks > 0) {
            answerKeyLeaksTotal.add(leaks, { endpoint: 'questions_batch', mode });
            journeyOk = false;
          }
          const dups = trackQuestionsAndDetectDuplicates(batchBody.questions, seenUids);
          if (dups > 0) {
            duplicateQuestionsTotal.add(dups, { endpoint: 'questions_batch', mode });
            journeyOk = false;
          }
          check(batchBody, {
            'batch 2 has zero answer-key leaks': () => leaks === 0,
            'batch 2 has zero duplicate questions': () => dups === 0,
          });
          for (const nextQ of batchBody.questions) {
            activeQuestions.push(nextQ);
          }
          nextCursor = batchBody.nextCursor || null;
          hasMore = Boolean(batchBody.hasMore);
        } else {
          journeyOk = false;
        }
      }
    }
  });

  // 3. Submit session
  let submittedOk = false;
  group('03_session_submit', () => {
    const submitRes = http.post(
      `${BASE_URL}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/submit`,
      JSON.stringify({ reason: 'manual' }),
      {
        headers: authHeaders(token, { 'Idempotency-Key': makeIdempotencyKey('k6_submit') }),
        tags: { endpoint: 'session_submit', mode, redis_mode: REDIS_MODE, stage: STAGE },
      },
    );
    sessionSubmitDurationMs.add(submitRes.timings.duration, { mode, redis_mode: REDIS_MODE });

    const submitBody = safeJson(submitRes);
    submittedOk = check(submitRes, {
      'session submit status is 200': (r) => r.status === 200,
      'session submit transitions to completed': () => submitBody?.status === 'completed',
      'session submit returns result summary': () => Boolean(submitBody?.result),
    });

    if (submittedOk) {
      sessionsCompletedTotal.add(1, { mode });
    } else {
      journeyOk = false;
    }
  });

  // 4. Fetch graded result & review (answer keys revealed ONLY here post-submit)
  if (submittedOk) {
    group('04_session_result', () => {
      const resultRes = http.get(
        `${BASE_URL}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/result`,
        {
          headers: authHeaders(token),
          tags: { endpoint: 'session_result', mode, redis_mode: REDIS_MODE, stage: STAGE },
        },
      );
      sessionResultDurationMs.add(resultRes.timings.duration, { mode, redis_mode: REDIS_MODE });

      const resultBody = safeJson(resultRes);
      const resultOk = check(resultRes, {
        'session result status is 200': (r) => r.status === 200,
        'session result status is completed': () => resultBody?.status === 'completed',
        'session result includes review array': () => Array.isArray(resultBody?.review),
      });
      if (!resultOk) {
        journeyOk = false;
      }
    });
  }

  journeySuccessRate.add(journeyOk);
  thinkPause(0.5, 1.5);
}

// ============================================================================
// Secondary Scenario: Legacy Read-Only Compatibility (`/api/questions/*`)
// ============================================================================
export function legacyReadOnlyJourney() {
  const sharedQuery = {};
  if (EXAM_MODE) sharedQuery.examMode = EXAM_MODE;
  if (TOPIC) sharedQuery.topic = TOPIC;
  if (SUBJECT) sharedQuery.subject = SUBJECT;

  group('legacy_questions_meta', () => {
    const metaQuery = buildQueryString(sharedQuery);
    const metaRes = http.get(`${BASE_URL}/api/questions/meta${metaQuery}`, {
      tags: { endpoint: 'legacy_meta', redis_mode: REDIS_MODE, stage: STAGE },
    });
    legacyMetaDurationMs.add(metaRes.timings.duration, { redis_mode: REDIS_MODE });
    check(metaRes, {
      'legacy /api/questions/meta status is 200': (r) => r.status === 200,
    });
  });

  thinkPause(0.3, 0.9);

  group('legacy_questions_session', () => {
    const sessionQuery = buildQueryString({ ...sharedQuery, limit: LEGACY_LIMIT });
    const sessionRes = http.get(`${BASE_URL}/api/questions/session${sessionQuery}`, {
      tags: { endpoint: 'legacy_questions_session', redis_mode: REDIS_MODE, stage: STAGE },
    });
    legacySessionDurationMs.add(sessionRes.timings.duration, { redis_mode: REDIS_MODE });

    const body = safeJson(sessionRes);
    const questions = Array.isArray(body?.questions) ? body.questions : [];
    const seen = new Set();
    const leaks = countAnswerKeyLeaks(questions);
    const dups = trackQuestionsAndDetectDuplicates(questions, seen);

    if (leaks > 0) answerKeyLeaksTotal.add(leaks, { endpoint: 'legacy_questions_session' });
    if (dups > 0) duplicateQuestionsTotal.add(dups, { endpoint: 'legacy_questions_session' });

    check(sessionRes, {
      'legacy /api/questions/session status is 200': (r) => r.status === 200,
      'legacy session returns questions array': () => Array.isArray(body?.questions),
      'legacy session has zero answer-key leaks': () => leaks === 0,
      'legacy session has zero duplicate questions': () => dups === 0,
    });
  });

  thinkPause(0.6, 1.5);
}

// ============================================================================
// Custom Summary Output (Human-Readable Table + JSON Artifact)
// ============================================================================
function metricValues(data, name) {
  return data?.metrics?.[name]?.values || null;
}

function fmtMs(val) {
  return Number.isFinite(val) ? `${val.toFixed(1)} ms` : 'n/a';
}

function fmtPct(ratio) {
  return Number.isFinite(ratio) ? `${(ratio * 100).toFixed(2)}%` : 'n/a';
}

function fmtCount(val) {
  return Number.isFinite(val) ? String(Math.round(val)) : '0';
}

function padRight(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + ' '.repeat(len - s.length);
}

function padLeft(str, len) {
  const s = String(str);
  return s.length >= len ? s : ' '.repeat(len - s.length) + s;
}

function extractTrendStats(values) {
  if (!values) return null;
  return {
    avgMs: round2(values.avg),
    p50Ms: round2(values.med),
    p90Ms: round2(values['p(90)']),
    p95Ms: round2(values['p(95)']),
    p99Ms: round2(values['p(99)']),
    maxMs: round2(values.max),
  };
}

function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function thresholdStatus(data, metricKey) {
  const metric = data?.metrics?.[metricKey];
  if (!metric?.thresholds) return 'N/A';
  const failed = Object.values(metric.thresholds).some((t) => t.ok === false);
  return failed ? 'FAIL' : 'PASS';
}

export function handleSummary(data) {
  const batchHttp = metricValues(data, 'http_req_duration{endpoint:questions_batch}');
  const createHttp = metricValues(data, 'http_req_duration{endpoint:session_create}');
  const answerTrend = metricValues(data, 'answer_submit_duration_ms');
  const submitTrend = metricValues(data, 'session_submit_duration_ms');
  const resultTrend = metricValues(data, 'session_result_duration_ms');
  const legacySessionTrend = metricValues(data, 'legacy_session_duration_ms');
  const legacyMetaTrend = metricValues(data, 'legacy_meta_duration_ms');
  const overallHttp = metricValues(data, 'http_req_duration');
  const reqsTotal = metricValues(data, 'http_reqs');
  const reqFailed = metricValues(data, 'http_req_failed');
  const vusMax = metricValues(data, 'vus_max');
  const batchBytes = metricValues(data, 'questions_batch_payload_bytes');

  const dupCount = metricValues(data, 'duplicate_questions_total')?.count || 0;
  const leakCount = metricValues(data, 'answer_key_leaks_total')?.count || 0;
  const failedAnsCount = metricValues(data, 'failed_answer_submissions_total')?.count || 0;
  const completedCount = metricValues(data, 'sessions_completed_total')?.count || 0;
  const answersCount = metricValues(data, 'answers_submitted_total')?.count || 0;
  const prefetchCount = metricValues(data, 'prefetch_batches_total')?.count || 0;
  const replaysCount = metricValues(data, 'idempotent_replays_verified_total')?.count || 0;

  const metricsScraped = (metricValues(data, 'meow_scraped_metrics_available')?.value || 0) >= 1;
  const tieredCacheHitRatio = metricValues(data, 'meow_scraped_cache_hit_ratio')?.value;
  const redisOnlyHitRatio = metricValues(data, 'meow_scraped_redis_hit_ratio')?.value;
  const cacheHitsDelta = metricValues(data, 'meow_scraped_cache_hits_delta')?.value;
  const cacheMissesDelta = metricValues(data, 'meow_scraped_cache_misses_delta')?.value;
  const redisHitsDelta = metricValues(data, 'meow_scraped_redis_hits_delta')?.value;
  const redisMissesDelta = metricValues(data, 'meow_scraped_redis_misses_delta')?.value;
  const mongoPoolBefore = metricValues(data, 'meow_scraped_mongo_pool_waiting_before')?.value;
  const mongoPoolAfter = metricValues(data, 'meow_scraped_mongo_pool_waiting_after')?.value;
  const mongoCmdsDelta = metricValues(data, 'meow_scraped_mongo_commands_delta')?.value;
  const redisFallbacksDelta = metricValues(data, 'meow_scraped_redis_fallbacks_delta')?.value;

  const sloVerdicts = {
    questionsBatchLatency: thresholdStatus(data, 'http_req_duration{endpoint:questions_batch}'),
    sessionCreateLatency: thresholdStatus(data, 'http_req_duration{endpoint:session_create}'),
    httpFailureRate: thresholdStatus(data, 'http_req_failed'),
    zeroDuplicates: thresholdStatus(data, 'duplicate_questions_total'),
    zeroAnswerKeyLeaks: thresholdStatus(data, 'answer_key_leaks_total'),
    zeroFailedAnswerSubmissions: thresholdStatus(data, 'failed_answer_submissions_total'),
  };
  const allThresholdsPassed = Object.values(sloVerdicts).every((v) => v !== 'FAIL');

  const latencyRows = [
    ['GET /v1/sessions/:id/questions', batchHttp || metricValues(data, 'questions_batch_duration_ms'), 'p95<200, p99<400', sloVerdicts.questionsBatchLatency],
    ['POST /v1/quiz/sessions', createHttp || metricValues(data, 'session_create_duration_ms'), 'p95<250', sloVerdicts.sessionCreateLatency],
    ['POST /v1/sessions/:id/answers', answerTrend, 'info', 'INFO'],
    ['POST /v1/sessions/:id/submit', submitTrend, 'info', 'INFO'],
    ['GET /v1/sessions/:id/result', resultTrend, 'info', 'INFO'],
    ['GET /questions/session (legacy)', legacySessionTrend, 'info', 'INFO'],
    ['GET /questions/meta (legacy)', legacyMetaTrend, 'info', 'INFO'],
    ['ALL http_req_duration', overallHttp, 'info', 'INFO'],
  ];

  const divider = '='.repeat(106);
  const subDivider = '-'.repeat(106);
  const lines = [
    '',
    divider,
    ` MEOW QUESTION DELIVERY LOAD TEST SUMMARY — ${ACTIVE_PROFILE.label}`,
    divider,
    ` Target: ${BASE_URL} | Stage: ${STAGE} | Redis Mode: ${REDIS_MODE.toUpperCase()} | Batch Size: ${BATCH_SIZE}`,
    ` Peak VUs: ${fmtCount(vusMax?.max)} | Total HTTP Reqs: ${fmtCount(reqsTotal?.count)} (${round2(reqsTotal?.rate) ?? 0} req/s) | Error Rate: ${fmtPct(reqFailed?.rate)} [${sloVerdicts.httpFailureRate}]`,
    ` Sessions Completed: ${fmtCount(completedCount)} | Answers Submitted: ${fmtCount(answersCount)} | Prefetches: ${fmtCount(prefetchCount)} | Idempotent Replays: ${fmtCount(replaysCount)}`,
    ` Avg Batch Payload: ${batchBytes ? `${(batchBytes.avg / 1024).toFixed(1)} KB (max ${(batchBytes.max / 1024).toFixed(1)} KB)` : 'n/a'}`,
    subDivider,
    ` ${padRight('Endpoint', 33)} ${padLeft('P50', 10)} ${padLeft('P95', 10)} ${padLeft('P99', 10)} ${padLeft('Max', 10)}  ${padRight('SLO Target', 17)} Status`,
    subDivider,
  ];

  for (const [label, stats, target, status] of latencyRows) {
    lines.push(
      ` ${padRight(label, 33)} ${padLeft(fmtMs(stats?.med), 10)} ${padLeft(fmtMs(stats?.['p(95)']), 10)} ${padLeft(fmtMs(stats?.['p(99)']), 10)} ${padLeft(fmtMs(stats?.max), 10)}  ${padRight(target, 17)} ${status}`,
    );
  }

  lines.push(subDivider);
  lines.push(' INTEGRITY & CORRECTNESS CHECKS');
  lines.push(
    `   duplicate_questions_total       : ${fmtCount(dupCount)}   (target == 0) [${sloVerdicts.zeroDuplicates}]`,
  );
  lines.push(
    `   answer_key_leaks_total          : ${fmtCount(leakCount)}   (target == 0) [${sloVerdicts.zeroAnswerKeyLeaks}]`,
  );
  lines.push(
    `   failed_answer_submissions_total : ${fmtCount(failedAnsCount)}   (target == 0) [${sloVerdicts.zeroFailedAnswerSubmissions}]`,
  );
  lines.push(subDivider);
  lines.push(' PROMETHEUS /metrics DELTA (Cache Hit Ratio & Mongo Pool)');

  if (metricsScraped) {
    const cacheTargetStatus =
      REDIS_MODE === 'enabled'
        ? (tieredCacheHitRatio >= 0.8 ? 'PASS (>80%)' : 'WARN (<80%)')
        : 'INFO (redis disabled)';
    lines.push(
      `   Tiered Cache Hit Ratio (L1+Redis) : ${fmtPct(tieredCacheHitRatio)} [${cacheTargetStatus}] (hits=${fmtCount(cacheHitsDelta)}, sourceMiss+bypass=${fmtCount(cacheMissesDelta)})`,
    );
    lines.push(
      `   Redis-Layer Hit Ratio             : ${fmtPct(redisOnlyHitRatio)} (redisHits=${fmtCount(redisHitsDelta)}, redisMisses=${fmtCount(redisMissesDelta)}, fallbacks=${fmtCount(redisFallbacksDelta)})`,
    );
    lines.push(
      `   Mongo Pool Waiting (before/after) : ${fmtCount(mongoPoolBefore)} -> ${fmtCount(mongoPoolAfter)} | Mongo Commands Delta: ${fmtCount(mongoCmdsDelta)}`,
    );
  } else {
    lines.push(
      '   /metrics scrape skipped (set METRICS_TOKEN to report Redis cache hit ratio & Mongo pool waiting).',
    );
  }

  lines.push(divider);
  lines.push(
    ` OVERALL SLO VERDICT: ${allThresholdsPassed ? 'PASS' : 'FAIL'} | JSON artifact -> ${SUMMARY_OUTPUT}`,
  );
  lines.push(divider);
  lines.push('');

  const jsonReport = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    config: {
      baseUrl: BASE_URL,
      stage: STAGE,
      stageLabel: ACTIVE_PROFILE.label,
      redisMode: REDIS_MODE,
      batchSize: BATCH_SIZE,
      legacyLimit: LEGACY_LIMIT,
      legacyEnabled: LEGACY_ENABLED,
      examMode: EXAM_MODE || null,
      topic: TOPIC || null,
      subject: SUBJECT || null,
      thinkTimeScale: THINK_TIME_SCALE,
    },
    verdict: {
      passed: allThresholdsPassed,
      thresholds: sloVerdicts,
    },
    throughput: {
      peakVus: vusMax?.max ?? 0,
      totalRequests: reqsTotal?.count ?? 0,
      requestsPerSec: round2(reqsTotal?.rate),
      httpFailedRate: reqFailed?.rate ?? 0,
      sessionsCompleted: completedCount,
      answersSubmitted: answersCount,
      prefetchBatches: prefetchCount,
      idempotentReplaysVerified: replaysCount,
      avgBatchPayloadBytes: round2(batchBytes?.avg),
      maxBatchPayloadBytes: round2(batchBytes?.max),
    },
    latency: {
      questionsBatch: extractTrendStats(batchHttp || metricValues(data, 'questions_batch_duration_ms')),
      sessionCreate: extractTrendStats(createHttp || metricValues(data, 'session_create_duration_ms')),
      answerSubmit: extractTrendStats(answerTrend),
      sessionSubmit: extractTrendStats(submitTrend),
      sessionResult: extractTrendStats(resultTrend),
      legacyQuestionsSession: extractTrendStats(legacySessionTrend),
      legacyQuestionsMeta: extractTrendStats(legacyMetaTrend),
      overallHttp: extractTrendStats(overallHttp),
    },
    integrity: {
      duplicateQuestionsTotal: dupCount,
      answerKeyLeaksTotal: leakCount,
      failedAnswerSubmissionsTotal: failedAnsCount,
      journeySuccessRate: metricValues(data, 'journey_success_rate')?.rate ?? null,
    },
    prometheusMetrics: metricsScraped
      ? {
          scraped: true,
          tieredCacheHitRatio: round2((tieredCacheHitRatio ?? 0) * 100),
          redisLayerHitRatio: round2((redisOnlyHitRatio ?? 0) * 100),
          cacheHitsDelta: Math.round(cacheHitsDelta ?? 0),
          cacheMissesDelta: Math.round(cacheMissesDelta ?? 0),
          redisHitsDelta: Math.round(redisHitsDelta ?? 0),
          redisMissesDelta: Math.round(redisMissesDelta ?? 0),
          redisFallbacksDelta: Math.round(redisFallbacksDelta ?? 0),
          mongoPoolWaitingBefore: Math.round(mongoPoolBefore ?? 0),
          mongoPoolWaitingAfter: Math.round(mongoPoolAfter ?? 0),
          mongoCommandsDelta: Math.round(mongoCmdsDelta ?? 0),
          cacheHitTargetMet: REDIS_MODE === 'enabled' ? (tieredCacheHitRatio ?? 0) >= 0.8 : null,
        }
      : {
          scraped: false,
          reason: 'METRICS_TOKEN not provided or /metrics unreachable',
        },
  };

  return {
    stdout: lines.join('\n'),
    [SUMMARY_OUTPUT]: JSON.stringify(jsonReport, null, 2),
  };
}
