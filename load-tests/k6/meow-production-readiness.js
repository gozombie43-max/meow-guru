import http from 'k6/http';
import { check, group, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  buildQueryString,
  countAnswerKeyLeaks,
  makeIdempotencyKey,
  pickOptionIndex,
  pickWeightedQuizMode,
  randomBetween,
  safeJson,
  trackUniqueQuestions,
} from './helpers/data.js';
import { validateTargetEnvironment } from './config/environment.js';
import { parsePrometheusMetrics, computePrometheusDeltas } from './helpers/reporting.js';

// ============================================================================
// Meow Production Readiness — Comprehensive R5 Multi-Journey k6 Suite
// ============================================================================
// Exercises all 6 production user journeys under realistic weighted traffic:
//   1. Auth (POST /auth/login + POST /auth/refresh)
//   2. Browse Exam Categories / Catalog (topic-counts, catalog-metadata, slots)
//   3. Load Questions (GET /api/questions/meta, GET /api/questions/session)
//   4. Quiz Session Lifecycle (create, answers + idempotent replay, batch2,
//      submit, result + zero answer-key leak assertions)
//   5. Mock Test Lifecycle (start, autosave, submit + idempotent replay, get)
//   6. Training, Leaderboards & Stats (training dashboard/session/actions,
//      battle leaderboard/season leaderboard, progress/topics, /users/me)
// ============================================================================

// Custom R5 SLO Metrics
export const readApiDuration = new Trend('read_api_duration', true);
export const writeApiDuration = new Trend('write_api_duration', true);
export const quizJourneyFailures = new Counter('quiz_journey_failures');
export const duplicateSubmissions = new Counter('duplicate_submissions');
export const answerKeyLeaks = new Counter('answer_key_leaks');

// Detailed breakdown & diagnostic counters
export const duplicateQuestionsTotal = new Counter('duplicate_questions_total');
export const replaysVerifiedTotal = new Counter('replays_verified_total');
export const authJourneysTotal = new Counter('auth_journeys_total');
export const browseJourneysTotal = new Counter('browse_journeys_total');
export const quizJourneysTotal = new Counter('quiz_journeys_total');
export const mockJourneysTotal = new Counter('mock_journeys_total');
export const trainingStatsJourneysTotal = new Counter('training_stats_journeys_total');
export const journeySuccessRate = new Rate('journey_success_rate');
export const http429Total = new Counter('http_429_total');
export const http5xxTotal = new Counter('http_5xx_total');
export const http401Total = new Counter('http_401_total');
export const httpNetErrorTotal = new Counter('http_net_error_total');

const STAGE_TARGETS = {
  smoke: { vus: 5, label: 'Smoke (5 VUs)', defaultRamp: '5s', defaultCooldown: '5s' },
  stage1: { vus: 30, label: 'Stage 1 — Baseline (30 VUs)', defaultRamp: '10s', defaultCooldown: '5s' },
  stage2: { vus: 100, label: 'Stage 2 — Light Load (100 VUs)', defaultRamp: '10s', defaultCooldown: '5s' },
  stage3: { vus: 250, label: 'Stage 3 — Moderate Load (250 VUs)', defaultRamp: '15s', defaultCooldown: '5s' },
  stage4: { vus: 500, label: 'Stage 4 — Target Peak (500 VUs)', defaultRamp: '15s', defaultCooldown: '5s' },
  stage5: { vus: 750, label: 'Stage 5 — High Stress (750 VUs)', defaultRamp: '20s', defaultCooldown: '5s' },
  stage6: { vus: 1000, label: 'Stage 6 — 1,000 CCU Gate (1000 VUs)', defaultRamp: '20s', defaultCooldown: '10s' },
  stage7: { vus: 1500, label: 'Stage 7 — Headroom (1200–1500 VUs)', defaultRamp: '15s', defaultCooldown: '10s' },
};

function clampFloat(raw, fallback, min, max) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number.parseFloat(String(raw));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function clampInt(raw, fallback, min, max) {
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback;
  const n = Number.parseInt(String(raw), 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
}

function buildConfig() {
  const envName = String(__ENV.K6_ENV || __ENV.ENVIRONMENT || 'local').trim().toLowerCase();
  const baseUrlRaw = String(__ENV.BASE_URL || __ENV.K6_BASE_URL || 'http://127.0.0.1:10000').trim();
  const validated = validateTargetEnvironment(envName, baseUrlRaw, __ENV);

  const stageName = String(__ENV.STAGE || __ENV.K6_STAGE || 'smoke').trim().toLowerCase();
  const stageDef = STAGE_TARGETS[stageName];
  if (!stageDef) {
    throw new Error(`Unknown STAGE="${stageName}". Expected one of: ${Object.keys(STAGE_TARGETS).join(', ')}`);
  }

  const stageDuration = String(__ENV.STAGE_DURATION || '60s').trim();
  const rampDuration = String(__ENV.RAMP_DURATION || stageDef.defaultRamp).trim();
  const cooldownDuration = String(__ENV.COOLDOWN_DURATION || stageDef.defaultCooldown).trim();
  const stage7TargetVus = clampInt(__ENV.STAGE7_TARGET_VUS, 1500, 1200, 1500);
  const peakVus = stageName === 'stage7' ? stage7TargetVus : stageDef.vus;

  const stages =
    stageName === 'stage7'
      ? [
          { duration: rampDuration, target: 1200 },
          { duration: rampDuration, target: peakVus },
          { duration: stageDuration, target: peakVus },
          { duration: cooldownDuration, target: 0 },
        ]
      : [
          { duration: rampDuration, target: peakVus },
          { duration: stageDuration, target: peakVus },
          { duration: cooldownDuration, target: 0 },
        ];

  const spoofIp = ['1', 'true', 'yes'].includes(
    String(__ENV.LOCAL_BENCH_SPOOF_IP || '').trim().toLowerCase(),
  );
  const origin = String(
    __ENV.K6_ORIGIN || __ENV.ORIGIN || __ENV.FRONTEND_URL || 'http://localhost:3000',
  )
    .trim()
    .replace(/\/+$/, '');

  return {
    envName: validated.envName,
    baseUrl: validated.baseUrl,
    stageName,
    stageLabel: stageName === 'stage7' ? `Stage 7 — Headroom (1200–${peakVus} VUs)` : stageDef.label,
    peakVus,
    stageDuration,
    rampDuration,
    cooldownDuration,
    stages,
    thinkTimeScale: clampFloat(__ENV.THINK_TIME_SCALE ?? __ENV.K6_THINK_TIME_SCALE, 1.0, 0, 5),
    spoofIp,
    origin,
    examSlug: String(__ENV.EXAM_SLUG || 'ssc-cgl').trim(),
    mockTestId: String(__ENV.MOCK_TEST_ID || 'cgl-mock-bench-1').trim(),
    metricsToken: String(__ENV.METRICS_TOKEN || __ENV.K6_METRICS_TOKEN || '').trim(),
    summaryPath: String(__ENV.SUMMARY_PATH || __ENV.SUMMARY_OUTPUT || '').trim(),
    authJourneyWeight: clampInt(__ENV.AUTH_JOURNEY_WEIGHT, 6, 1, 30),
    requestTimeout: String(__ENV.HTTP_TIMEOUT || '30s').trim(),
  };
}

const config = buildConfig();

// Optional init-context credential pool loaded from JSON file (avoids Windows env length limits)
let FILE_ACCOUNTS = null;
if (__ENV.TEST_ACCOUNTS_FILE) {
  const rawFile = open(__ENV.TEST_ACCOUNTS_FILE);
  FILE_ACCOUNTS = JSON.parse(rawFile);
}

export const options = {
  scenarios: {
    production_readiness_mix: {
      executor: 'ramping-vus',
      exec: 'default',
      startVUs: 0,
      stages: config.stages,
      gracefulRampDown: '15s',
      tags: {
        suite: 'meow-production-readiness',
        stage: config.stageName,
        env: config.envName,
      },
    },
  },
  tags: {
    suite: 'meow-production-readiness',
    stage: config.stageName,
    env: config.envName,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: {
    read_api_duration: ['p(95)<500'],
    write_api_duration: ['p(95)<800'],
    http_req_failed: ['rate<0.01'],
    quiz_journey_failures: ['count==0'],
    duplicate_submissions: ['count==0'],
    answer_key_leaks: ['count==0'],
  },
};

function vuSpoofedIp(vuId) {
  const id = Math.max(1, Number(vuId) || 1);
  const third = Math.floor((id - 1) / 250) % 250;
  const fourth = ((id - 1) % 250) + 1;
  return `10.0.${third}.${fourth}`;
}

function buildHeaders(token, extra = {}, vuId = null) {
  const headers = {
    'Content-Type': 'application/json',
    Origin: config.origin,
    ...extra,
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (config.spoofIp) {
    const id = vuId ?? exec.vu?.idInTest ?? 1;
    headers['X-Forwarded-For'] = vuSpoofedIp(id);
  }
  return headers;
}

function getHeaderCI(res, name) {
  if (!res?.headers) return null;
  const lower = String(name).toLowerCase();
  for (const [k, v] of Object.entries(res.headers)) {
    if (String(k).toLowerCase() === lower) {
      return Array.isArray(v) ? String(v[0]) : String(v);
    }
  }
  return null;
}

function recordApiMetrics(res, kind, endpoint) {
  const tags = { endpoint, stage: config.stageName };
  if (kind === 'read') {
    readApiDuration.add(res.timings.duration, tags);
  } else {
    writeApiDuration.add(res.timings.duration, tags);
  }
  if (res.status === 0) {
    httpNetErrorTotal.add(1, tags);
  } else if (res.status === 429) {
    http429Total.add(1, tags);
  } else if (res.status === 401) {
    http401Total.add(1, tags);
  } else if (res.status >= 500) {
    http5xxTotal.add(1, tags);
  }
}

function thinkPause(minSec, maxSec) {
  if (config.thinkTimeScale <= 0) return;
  sleep(randomBetween(minSec, maxSec) * config.thinkTimeScale);
}

function extractMockQuestions(paper) {
  if (!paper || !Array.isArray(paper.sections)) return [];
  const list = [];
  for (const section of paper.sections) {
    if (Array.isArray(section?.questions)) {
      for (const q of section.questions) list.push(q);
    }
  }
  return list;
}

function loadPoolAccounts() {
  if (Array.isArray(FILE_ACCOUNTS) && FILE_ACCOUNTS.length > 0) {
    return FILE_ACCOUNTS;
  }
  if (__ENV.TEST_ACCOUNTS_JSON) {
    const parsed = JSON.parse(__ENV.TEST_ACCOUNTS_JSON);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  }
  if (__ENV.AUTH_TOKENS) {
    const tokens = String(__ENV.AUTH_TOKENS)
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length > 0) return tokens.map((token) => ({ token }));
  }
  if (__ENV.AUTH_TOKEN) {
    return [{ token: String(__ENV.AUTH_TOKEN).trim() }];
  }
  if (__ENV.TEST_EMAIL && __ENV.TEST_PASSWORD) {
    return [{ email: String(__ENV.TEST_EMAIL).trim(), password: String(__ENV.TEST_PASSWORD) }];
  }
  throw new Error(
    'Provide TEST_ACCOUNTS_FILE, TEST_ACCOUNTS_JSON, AUTH_TOKENS, AUTH_TOKEN, or TEST_EMAIL+TEST_PASSWORD',
  );
}

function scrapeMetrics(phase) {
  if (!config.metricsToken) return null;
  const res = http.get(`${config.baseUrl}/metrics`, {
    headers: { Authorization: `Bearer ${config.metricsToken}` },
    tags: { endpoint: 'metrics_scrape', phase },
    timeout: config.requestTimeout,
  });
  if (res.status !== 200) return null;
  return parsePrometheusMetrics(res.body);
}

export function setup() {
  const healthRes = http.get(`${config.baseUrl}/api/health`, {
    tags: { endpoint: 'health_check' },
    timeout: config.requestTimeout,
  });
  check(healthRes, {
    'setup: /api/health returns 200': (r) => r.status === 200,
  });

  const rawAccounts = loadPoolAccounts();
  const pool = [];
  for (let i = 0; i < rawAccounts.length; i++) {
    const acc = rawAccounts[i];
    if (acc.token) {
      pool.push({
        email: acc.email || null,
        password: acc.password || null,
        token: acc.token,
      });
      continue;
    }
    const jar = http.cookieJar();
    const res = http.post(
      `${config.baseUrl}/auth/login`,
      JSON.stringify({ email: acc.email, password: acc.password }),
      {
        headers: buildHeaders(null, {}, i + 1),
        jar,
        tags: { endpoint: 'setup_login' },
        timeout: config.requestTimeout,
      },
    );
    const body = safeJson(res);
    if (res.status !== 200 || !body?.token) {
      throw new Error(`Setup login failed for ${acc.email}: HTTP ${res.status}`);
    }
    pool.push({
      email: acc.email,
      password: acc.password,
      token: body.token,
    });
  }

  const beforeMetrics = scrapeMetrics('before');
  return {
    pool,
    beforeMetrics,
    startedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Journey 1 — Auth (POST /auth/login + POST /auth/refresh)
// ============================================================================
function runAuthJourney(account) {
  authJourneysTotal.add(1);
  if (!account?.email || !account?.password) {
    return true;
  }

  let ok = true;
  group('01_auth_login_refresh', () => {
    const jar = http.cookieJar();
    const loginRes = http.post(
      `${config.baseUrl}/auth/login`,
      JSON.stringify({ email: account.email, password: account.password }),
      {
        headers: buildHeaders(null),
        jar,
        tags: { endpoint: 'auth_login', kind: 'write' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(loginRes, 'write', 'auth_login');
    const loginBody = safeJson(loginRes);
    const loginOk = check(loginRes, {
      'auth login status 200': (r) => r.status === 200,
      'auth login returns JWT': () => Boolean(loginBody?.token),
    });
    if (!loginOk) {
      ok = false;
      return;
    }

    const refreshCookieVal = loginRes.cookies?.refreshToken?.[0]?.value || null;
    const refreshExtraHeaders = {};
    // Local HTTP loopback cannot transmit Secure cookies via jar automatically;
    // explicitly forward the returned refreshToken cookie when testing local HTTP.
    if (config.baseUrl.startsWith('http://') && refreshCookieVal) {
      refreshExtraHeaders.Cookie = `refreshToken=${refreshCookieVal}`;
    }

    const refreshRes = http.post(`${config.baseUrl}/auth/refresh`, null, {
      headers: buildHeaders(null, refreshExtraHeaders),
      jar,
      tags: { endpoint: 'auth_refresh', kind: 'write' },
      timeout: config.requestTimeout,
    });
    recordApiMetrics(refreshRes, 'write', 'auth_refresh');
    const refreshBody = safeJson(refreshRes);
    const refreshOk = check(refreshRes, {
      'auth refresh status 200': (r) => r.status === 200,
      'auth refresh returns rotated JWT': () => Boolean(refreshBody?.token),
    });
    if (!refreshOk) {
      ok = false;
    }
  });
  return ok;
}

// ============================================================================
// Journey 2 & 3 — Browse Exam Categories / Catalog & Load Questions
// ============================================================================
function runBrowseAndLoadQuestionsJourney(account) {
  browseJourneysTotal.add(1);
  let ok = true;
  const subjects = ['mathematics', 'reasoning', 'english', 'general awareness'];
  const subject = subjects[(exec.vu.idInTest + exec.vu.iterationInScenario) % subjects.length];
  const progressSubject = subject === 'general awareness' ? 'general-awareness' : subject;

  group('02_browse_catalog_and_load_questions', () => {
    const tcRes = http.get(
      `${config.baseUrl}/api/questions/topic-counts${buildQueryString({ subject: progressSubject })}`,
      {
        headers: buildHeaders(account.token),
        tags: { endpoint: 'questions_topic_counts', kind: 'read' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(tcRes, 'read', 'questions_topic_counts');
    if (!check(tcRes, { 'topic-counts status 200': (r) => r.status === 200 })) ok = false;

    const catRes = http.get(`${config.baseUrl}/api/mocktest/catalog-metadata`, {
      headers: buildHeaders(account.token),
      tags: { endpoint: 'mocktest_catalog_metadata', kind: 'read' },
      timeout: config.requestTimeout,
    });
    recordApiMetrics(catRes, 'read', 'mocktest_catalog_metadata');
    if (!check(catRes, { 'catalog-metadata status 200': (r) => r.status === 200 })) ok = false;

    const slotsRes = http.get(`${config.baseUrl}/api/mocktest/${encodeURIComponent(config.examSlug)}/slots`, {
      headers: buildHeaders(account.token),
      tags: { endpoint: 'mocktest_exam_slots', kind: 'read' },
      timeout: config.requestTimeout,
    });
    recordApiMetrics(slotsRes, 'read', 'mocktest_exam_slots');
    if (!check(slotsRes, { 'exam slots status 200': (r) => r.status === 200 })) ok = false;

    const metaRes = http.get(
      `${config.baseUrl}/api/questions/meta${buildQueryString({ examMode: 'ssc', subject: 'mathematics' })}`,
      {
        headers: buildHeaders(account.token),
        tags: { endpoint: 'questions_meta', kind: 'read' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(metaRes, 'read', 'questions_meta');
    if (!check(metaRes, { 'questions meta status 200': (r) => r.status === 200 })) ok = false;

    const sessRes = http.get(
      `${config.baseUrl}/api/questions/session${buildQueryString({ limit: 20, examMode: 'ssc', subject: 'mathematics' })}`,
      {
        headers: buildHeaders(account.token),
        tags: { endpoint: 'questions_session', kind: 'read' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(sessRes, 'read', 'questions_session');
    const sessBody = safeJson(sessRes);
    const qs = Array.isArray(sessBody?.questions) ? sessBody.questions : [];
    const leaks = countAnswerKeyLeaks(qs);
    if (leaks > 0) {
      answerKeyLeaks.add(leaks, { endpoint: 'questions_session' });
      ok = false;
    }
    if (
      !check(sessRes, {
        'questions session status 200': (r) => r.status === 200,
        'questions session non-empty': () => qs.length > 0,
        'questions session 0 answer-key leaks': () => leaks === 0,
      })
    ) {
      ok = false;
    }
  });

  return ok;
}

// ============================================================================
// Journey 4 — Quiz Session Lifecycle (v1) + Replay & Leak Assertions
// ============================================================================
function runQuizSessionJourney(account) {
  quizJourneysTotal.add(1);
  const vuCtx = { vu: exec.vu.idInTest, iter: exec.vu.iterationInScenario };
  const mode = pickWeightedQuizMode('');
  const isExamStyle = mode === 'mock' || mode === 'speed';
  const seenUids = new Set();
  let ok = true;

  let sessionId = null;
  let batch1 = [];
  let nextCursor = null;
  let hasMore = false;

  group('03_quiz_session_lifecycle', () => {
    const createKey = makeIdempotencyKey('r5_qc', vuCtx);
    const createRes = http.post(
      `${config.baseUrl}/api/v1/quiz/sessions`,
      JSON.stringify({
        mode,
        subject: 'mathematics',
        examMode: 'ssc',
        batchSize: 10,
        totalQuestions: 20,
        lang: 'en',
        randomize: true,
      }),
      {
        headers: buildHeaders(account.token, { 'Idempotency-Key': createKey }),
        tags: { endpoint: 'quiz_session_create', kind: 'write', mode },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(createRes, 'write', 'quiz_session_create');
    const createBody = safeJson(createRes);
    const createdOk = check(createRes, {
      'quiz session create 201': (r) => r.status === 201,
      'quiz session create returns sessionId': () => Boolean(createBody?.sessionId),
      'quiz session create returns questions': () => Array.isArray(createBody?.questions) && createBody.questions.length > 0,
    });
    if (!createdOk || !createBody?.sessionId) {
      ok = false;
      return;
    }

    sessionId = createBody.sessionId;
    batch1 = createBody.questions;
    nextCursor = createBody.nextCursor || null;
    hasMore = Boolean(createBody.hasMore);

    const b1Leaks = countAnswerKeyLeaks(batch1);
    if (b1Leaks > 0) {
      answerKeyLeaks.add(b1Leaks, { endpoint: 'quiz_session_create', mode });
      ok = false;
    }
    const b1Dups = trackUniqueQuestions(batch1, seenUids);
    if (b1Dups > 0) {
      duplicateQuestionsTotal.add(b1Dups, { endpoint: 'quiz_session_create' });
      ok = false;
    }

    // Submit 3 answers + deliberate duplicate replay check on answer #1
    const answerCount = Math.min(3, batch1.length);
    for (let i = 0; i < answerCount; i++) {
      const q = batch1[i];
      if (!q?.questionUid) continue;
      const submissionId = makeIdempotencyKey(`r5_qa${i}`, vuCtx);
      const payload = JSON.stringify({
        questionUid: q.questionUid,
        answer: pickOptionIndex(q),
        timeTakenMs: 1800 + i * 300,
        submissionId,
      });

      const ansRes = http.post(
        `${config.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/answers`,
        payload,
        {
          headers: buildHeaders(account.token, { 'Idempotency-Key': submissionId }),
          tags: { endpoint: 'quiz_answer_submit', kind: 'write', mode },
          timeout: config.requestTimeout,
        },
      );
      recordApiMetrics(ansRes, 'write', 'quiz_answer_submit');
      const ansBody = safeJson(ansRes);
      const accepted = ansRes.status === 200 && ansBody?.accepted === true;
      if (!accepted) ok = false;

      if (accepted && isExamStyle && ansBody?.evaluation !== undefined) {
        answerKeyLeaks.add(1, { endpoint: 'quiz_answer_submit', mode });
        ok = false;
      }

      check(ansRes, {
        'quiz answer 200 & accepted': () => accepted,
        'quiz exam mode no pre-submit answer leak': () => !isExamStyle || ansBody?.evaluation === undefined,
      });

      // Deliberate duplicate-submission replay check on answer #1
      if (i === 0 && accepted) {
        const replayRes = http.post(
          `${config.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/answers`,
          payload,
          {
            headers: buildHeaders(account.token, { 'Idempotency-Key': submissionId }),
            tags: { endpoint: 'quiz_answer_replay', kind: 'write', mode },
            timeout: config.requestTimeout,
          },
        );
        recordApiMetrics(replayRes, 'write', 'quiz_answer_replay');
        const replayBody = safeJson(replayRes);
        const replayedHeader = getHeaderCI(replayRes, 'Idempotency-Replayed');
        const replayOk =
          replayRes.status === 200 &&
          replayBody?.accepted === true &&
          replayedHeader === 'true';
        if (replayOk) {
          replaysVerifiedTotal.add(1, { type: 'quiz_answer' });
        } else {
          duplicateSubmissions.add(1, { type: 'quiz_answer_replay' });
          ok = false;
        }
        check(replayRes, {
          'quiz answer replay 200 & Idempotency-Replayed: true': () => replayOk,
        });
      }
    }

    // Batch 2 cursor fetch
    if (hasMore && nextCursor) {
      const b2Res = http.get(
        `${config.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/questions${buildQueryString({
          cursor: nextCursor,
          batchSize: 10,
          lang: 'en',
        })}`,
        {
          headers: buildHeaders(account.token),
          tags: { endpoint: 'quiz_questions_batch', kind: 'read', mode },
          timeout: config.requestTimeout,
        },
      );
      recordApiMetrics(b2Res, 'read', 'quiz_questions_batch');
      const b2Body = safeJson(b2Res);
      const b2Qs = Array.isArray(b2Body?.questions) ? b2Body.questions : [];
      const b2Leaks = countAnswerKeyLeaks(b2Qs);
      if (b2Leaks > 0) {
        answerKeyLeaks.add(b2Leaks, { endpoint: 'quiz_questions_batch', mode });
        ok = false;
      }
      const b2Dups = trackUniqueQuestions(b2Qs, seenUids);
      if (b2Dups > 0) {
        duplicateQuestionsTotal.add(b2Dups, { endpoint: 'quiz_questions_batch' });
        ok = false;
      }
      if (
        !check(b2Res, {
          'quiz batch2 status 200': (r) => r.status === 200,
          'quiz batch2 0 answer-key leaks': () => b2Leaks === 0,
          'quiz batch2 0 duplicates': () => b2Dups === 0,
        })
      ) {
        ok = false;
      }
    }

    // Submit quiz session
    const submitKey = makeIdempotencyKey('r5_qs', vuCtx);
    const submitRes = http.post(
      `${config.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/submit`,
      JSON.stringify({ reason: 'manual' }),
      {
        headers: buildHeaders(account.token, { 'Idempotency-Key': submitKey }),
        tags: { endpoint: 'quiz_session_submit', kind: 'write', mode },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(submitRes, 'write', 'quiz_session_submit');
    const submitBody = safeJson(submitRes);
    const submitOk = check(submitRes, {
      'quiz submit 200': (r) => r.status === 200,
      'quiz submit completed': () => submitBody?.status === 'completed',
    });
    if (!submitOk) {
      ok = false;
      return;
    }

    // Get quiz session result
    const resultRes = http.get(
      `${config.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/result`,
      {
        headers: buildHeaders(account.token),
        tags: { endpoint: 'quiz_session_result', kind: 'read', mode },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(resultRes, 'read', 'quiz_session_result');
    const resultBody = safeJson(resultRes);
    const resultOk = check(resultRes, {
      'quiz result 200': (r) => r.status === 200,
      'quiz result completed & review array': () =>
        resultBody?.status === 'completed' && Array.isArray(resultBody?.review),
    });
    if (!resultOk) ok = false;
  });

  if (!ok) {
    quizJourneyFailures.add(1, { mode });
  }
  return ok;
}

// ============================================================================
// Journey 5 — Mock Test Lifecycle (start, autosave, submit + replay, get)
// ============================================================================
function runMockTestJourney(account) {
  mockJourneysTotal.add(1);
  const vuCtx = { vu: exec.vu.idInTest, iter: exec.vu.iterationInScenario };
  let ok = true;

  group('04_mock_test_lifecycle', () => {
    const startKey = makeIdempotencyKey('r5_ms', vuCtx);
    const startRes = http.post(
      `${config.baseUrl}/api/mocktest/${encodeURIComponent(config.examSlug)}/${encodeURIComponent(config.mockTestId)}/start`,
      JSON.stringify({ restart: true, language: 'en' }),
      {
        headers: buildHeaders(account.token, { 'Idempotency-Key': startKey }),
        tags: { endpoint: 'mocktest_start', kind: 'write' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(startRes, 'write', 'mocktest_start');
    const startBody = safeJson(startRes);
    const attemptId = startBody?.attemptId || startBody?.id;
    const mockQuestions = extractMockQuestions(startBody?.paper);
    const preSubmitLeaks =
      countAnswerKeyLeaks(mockQuestions) + (startBody?.answerKey !== undefined ? 1 : 0);
    if (preSubmitLeaks > 0) {
      answerKeyLeaks.add(preSubmitLeaks, { endpoint: 'mocktest_start' });
      ok = false;
    }

    const startOk = check(startRes, {
      'mock start 200/201': (r) => r.status === 201 || r.status === 200,
      'mock start returns attemptId': () => Boolean(attemptId),
      'mock start 0 answer-key leaks': () => preSubmitLeaks === 0,
    });
    if (!startOk || !attemptId) {
      ok = false;
      return;
    }

    // Autosave 2 answers
    const answers = {};
    const questionStatuses = {};
    for (let i = 0; i < Math.min(2, mockQuestions.length); i++) {
      const q = mockQuestions[i];
      if (!q?.id) continue;
      answers[q.id] = Array.isArray(q.options) && q.options.length > 0
        ? (typeof q.options[0] === 'string' ? q.options[0] : (q.options[0]?.id ?? 'Option A'))
        : 'Option A';
      questionStatuses[q.id] = 'answered';
    }

    const autosaveRes = http.patch(
      `${config.baseUrl}/api/mocktest/attempt/${encodeURIComponent(attemptId)}/autosave`,
      JSON.stringify({
        revision: 1,
        baseRevision: 0,
        currentSection: 0,
        currentQuestion: 1,
        answers,
        questionStatuses,
      }),
      {
        headers: buildHeaders(account.token),
        tags: { endpoint: 'mocktest_autosave', kind: 'write' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(autosaveRes, 'write', 'mocktest_autosave');
    const autosaveBody = safeJson(autosaveRes);
    if (
      !check(autosaveRes, {
        'mock autosave 200 & ok': (r) => r.status === 200 && autosaveBody?.ok === true,
      })
    ) {
      ok = false;
    }

    // Submit attempt + deliberate duplicate-submit replay check
    const submitKey = makeIdempotencyKey('r5_msub', vuCtx);
    const submitRes = http.post(
      `${config.baseUrl}/api/mocktest/attempt/${encodeURIComponent(attemptId)}/submit`,
      JSON.stringify({}),
      {
        headers: buildHeaders(account.token, { 'Idempotency-Key': submitKey }),
        tags: { endpoint: 'mocktest_submit', kind: 'write' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(submitRes, 'write', 'mocktest_submit');
    const submitBody = safeJson(submitRes);
    const submitOk = check(submitRes, {
      'mock submit 200': (r) => r.status === 200,
      'mock submit returns result': () => Boolean(submitBody?.result),
    });
    if (!submitOk) {
      ok = false;
      return;
    }

    // Deliberate duplicate submit replay with identical Idempotency-Key
    const replayRes = http.post(
      `${config.baseUrl}/api/mocktest/attempt/${encodeURIComponent(attemptId)}/submit`,
      JSON.stringify({}),
      {
        headers: buildHeaders(account.token, { 'Idempotency-Key': submitKey }),
        tags: { endpoint: 'mocktest_submit_replay', kind: 'write' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(replayRes, 'write', 'mocktest_submit_replay');
    const replayBody = safeJson(replayRes);
    const replayedHeader = getHeaderCI(replayRes, 'Idempotency-Replayed');
    const replayOk =
      replayRes.status === 200 &&
      Boolean(replayBody?.result) &&
      (replayedHeader === 'true' || replayBody?.idempotent === true);
    if (replayOk) {
      replaysVerifiedTotal.add(1, { type: 'mock_submit' });
    } else {
      duplicateSubmissions.add(1, { type: 'mock_submit_replay' });
      ok = false;
    }
    check(replayRes, {
      'mock submit replay 200 & replayed': () => replayOk,
    });

    // Fetch completed attempt details
    const detailRes = http.get(
      `${config.baseUrl}/api/mocktest/attempt/${encodeURIComponent(attemptId)}`,
      {
        headers: buildHeaders(account.token),
        tags: { endpoint: 'mocktest_get_attempt', kind: 'read' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(detailRes, 'read', 'mocktest_get_attempt');
    const detailBody = safeJson(detailRes);
    if (
      !check(detailRes, {
        'mock get attempt 200 & completed': (r) =>
          r.status === 200 && detailBody?.status === 'completed',
      })
    ) {
      ok = false;
    }
  });

  return ok;
}

// ============================================================================
// Journey 6 — Training, Leaderboards & Stats
// ============================================================================
function runTrainingLeaderboardsStatsJourney(account) {
  trainingStatsJourneysTotal.add(1);
  const vuCtx = { vu: exec.vu.idInTest, iter: exec.vu.iterationInScenario };
  let ok = true;

  group('05_training_leaderboards_stats', () => {
    const dashRes = http.get(
      `${config.baseUrl}/api/training/dashboard${buildQueryString({ exam: config.examSlug })}`,
      {
        headers: buildHeaders(account.token),
        tags: { endpoint: 'training_dashboard', kind: 'read' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(dashRes, 'read', 'training_dashboard');
    if (!check(dashRes, { 'training dashboard 200': (r) => r.status === 200 })) ok = false;

    const createKey = makeIdempotencyKey('r5_trc', vuCtx);
    const trStartRes = http.post(
      `${config.baseUrl}/api/training/sessions`,
      JSON.stringify({
        mode: 'sprint',
        exam: config.examSlug,
        tier: '1',
        count: 10,
        minutes: 5,
      }),
      {
        headers: buildHeaders(account.token, { 'Idempotency-Key': createKey }),
        tags: { endpoint: 'training_session_create', kind: 'write' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(trStartRes, 'write', 'training_session_create');
    const trSession = safeJson(trStartRes);
    const trOk = check(trStartRes, {
      'training session create 200/201': (r) => r.status === 201 || r.status === 200,
      'training session returns id': () => Boolean(trSession?.id),
    });
    if (trOk && trSession?.id) {
      const revision = Number.isInteger(trSession.revision) ? trSession.revision : 0;
      const ansKey = makeIdempotencyKey('r5_tra', vuCtx);
      const ansRes = http.post(
        `${config.baseUrl}/api/training/sessions/${encodeURIComponent(trSession.id)}/actions?response=delta`,
        JSON.stringify({
          type: 'answer',
          revision,
          choice: 0,
          confidence: 'sure',
        }),
        {
          headers: buildHeaders(account.token, { 'Idempotency-Key': ansKey }),
          tags: { endpoint: 'training_action_answer', kind: 'write' },
          timeout: config.requestTimeout,
        },
      );
      recordApiMetrics(ansRes, 'write', 'training_action_answer');
      const ansBody = safeJson(ansRes);
      if (!check(ansRes, { 'training action answer 200': (r) => r.status === 200 })) {
        ok = false;
      } else {
        const nextRev = Number.isInteger(ansBody?.revision) ? ansBody.revision : revision + 1;
        const finKey = makeIdempotencyKey('r5_trf', vuCtx);
        const finRes = http.post(
          `${config.baseUrl}/api/training/sessions/${encodeURIComponent(trSession.id)}/actions?response=delta`,
          JSON.stringify({ type: 'finish', revision: nextRev }),
          {
            headers: buildHeaders(account.token, { 'Idempotency-Key': finKey }),
            tags: { endpoint: 'training_action_finish', kind: 'write' },
            timeout: config.requestTimeout,
          },
        );
        recordApiMetrics(finRes, 'write', 'training_action_finish');
        if (!check(finRes, { 'training action finish 200': (r) => r.status === 200 })) ok = false;
      }
    } else {
      ok = false;
    }

    const lbRes = http.get(`${config.baseUrl}/api/battle/leaderboard`, {
      headers: buildHeaders(account.token),
      tags: { endpoint: 'battle_leaderboard', kind: 'read' },
      timeout: config.requestTimeout,
    });
    recordApiMetrics(lbRes, 'read', 'battle_leaderboard');
    if (!check(lbRes, { 'battle leaderboard 200': (r) => r.status === 200 })) ok = false;

    const seasonLbRes = http.get(`${config.baseUrl}/api/battle/season/leaderboard`, {
      headers: buildHeaders(account.token),
      tags: { endpoint: 'battle_season_leaderboard', kind: 'read' },
      timeout: config.requestTimeout,
    });
    recordApiMetrics(seasonLbRes, 'read', 'battle_season_leaderboard');
    if (!check(seasonLbRes, { 'battle season leaderboard 200': (r) => r.status === 200 })) ok = false;

    const progRes = http.get(
      `${config.baseUrl}/api/progress/topics${buildQueryString({ subject: 'mathematics' })}`,
      {
        headers: buildHeaders(account.token),
        tags: { endpoint: 'progress_topics', kind: 'read' },
        timeout: config.requestTimeout,
      },
    );
    recordApiMetrics(progRes, 'read', 'progress_topics');
    if (!check(progRes, { 'progress topics 200': (r) => r.status === 200 })) ok = false;

    const meRes = http.get(`${config.baseUrl}/users/me`, {
      headers: buildHeaders(account.token),
      tags: { endpoint: 'users_me', kind: 'read' },
      timeout: config.requestTimeout,
    });
    recordApiMetrics(meRes, 'read', 'users_me');
    if (!check(meRes, { 'users me 200': (r) => r.status === 200 })) ok = false;
  });

  return ok;
}

export default function (data) {
  const pool = data?.pool || [];
  const account = pool[((exec.vu.idInTest || 1) - 1) % pool.length];

  // Weighted realistic multi-journey mix summing to 100:
  //   Auth (login+refresh):               config.authJourneyWeight (default 6%)
  //   Browse Catalog & Load Questions:    24%
  //   Quiz Session Lifecycle (v1):        32%
  //   Mock Test Lifecycle:                18%
  //   Training, Leaderboards & Stats:     20%
  const roll = Math.random() * 100;
  const authCut = config.authJourneyWeight;
  const browseCut = authCut + 24;
  const quizCut = browseCut + 32;
  const mockCut = quizCut + 18;

  let journeyOk;
  if (roll < authCut) {
    journeyOk = runAuthJourney(account);
  } else if (roll < browseCut) {
    journeyOk = runBrowseAndLoadQuestionsJourney(account);
  } else if (roll < quizCut) {
    journeyOk = runQuizSessionJourney(account);
  } else if (roll < mockCut) {
    journeyOk = runMockTestJourney(account);
  } else {
    journeyOk = runTrainingLeaderboardsStatsJourney(account);
  }

  journeySuccessRate.add(journeyOk);
  thinkPause(0.4, 1.1);
}

export function teardown(data) {
  if (data?.beforeMetrics) {
    const afterMetrics = scrapeMetrics('after');
    if (afterMetrics) {
      data.prometheusDeltas = computePrometheusDeltas(data.beforeMetrics, afterMetrics);
    }
  }
}

function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function summarizeTrend(metric) {
  const v = metric?.values;
  if (!v) return null;
  return {
    avgMs: round2(v.avg),
    minMs: round2(v.min),
    p50Ms: round2(v.med),
    p90Ms: round2(v['p(90)']),
    p95Ms: round2(v['p(95)']),
    p99Ms: round2(v['p(99)']),
    maxMs: round2(v.max),
  };
}

export function handleSummary(data) {
  const m = data.metrics || {};
  const totalReqs = m.http_reqs?.values?.count ?? 0;
  const rps = round2(m.http_reqs?.values?.rate) ?? 0;
  const failedRate = m.http_req_failed?.values?.rate ?? 0;
  const failedCount = m.http_req_failed?.values?.passes ?? 0;
  const checksRate = m.checks?.values?.rate ?? 0;
  const peakVus = m.vus_max?.values?.max ?? 0;

  const thresholds = {};
  let allThresholdsPassed = true;
  for (const [metricName, metricObj] of Object.entries(m)) {
    if (!metricObj?.thresholds) continue;
    thresholds[metricName] = {};
    for (const [expr, res] of Object.entries(metricObj.thresholds)) {
      const ok = Boolean(res?.ok);
      thresholds[metricName][expr] = ok;
      if (!ok) allThresholdsPassed = false;
    }
  }

  const summary = {
    schemaVersion: 1,
    suite: 'meow-production-readiness',
    timestamp: new Date().toISOString(),
    stage: config.stageName,
    stageLabel: config.stageLabel,
    environment: config.envName,
    baseUrl: config.baseUrl,
    targetPeakVus: config.peakVus,
    measuredPeakVus: peakVus,
    durationSec: round2((data.state?.testRunDurationMs || 0) / 1000),
    stageDuration: config.stageDuration,
    thinkTimeScale: config.thinkTimeScale,
    spoofIp: config.spoofIp,
    throughput: {
      totalRequests: totalReqs,
      requestsPerSec: rps,
      httpFailedCount: failedCount,
      httpFailedRate: round2(failedRate * 10000) / 10000,
      httpFailedPct: round2(failedRate * 100),
      checksPassPct: round2(checksRate * 100),
      journeySuccessPct: round2((m.journey_success_rate?.values?.rate ?? 0) * 100),
    },
    latency: {
      readApi: summarizeTrend(m.read_api_duration),
      writeApi: summarizeTrend(m.write_api_duration),
      overallHttp: summarizeTrend(m.http_req_duration),
    },
    journeys: {
      auth: m.auth_journeys_total?.values?.count ?? 0,
      browseAndQuestions: m.browse_journeys_total?.values?.count ?? 0,
      quizSession: m.quiz_journeys_total?.values?.count ?? 0,
      mockTest: m.mock_journeys_total?.values?.count ?? 0,
      trainingLeaderboardsStats: m.training_stats_journeys_total?.values?.count ?? 0,
    },
    integrity: {
      quizJourneyFailures: m.quiz_journey_failures?.values?.count ?? 0,
      duplicateSubmissions: m.duplicate_submissions?.values?.count ?? 0,
      answerKeyLeaks: m.answer_key_leaks?.values?.count ?? 0,
      duplicateQuestions: m.duplicate_questions_total?.values?.count ?? 0,
      replaysVerified: m.replays_verified_total?.values?.count ?? 0,
    },
    errors: {
      http429: m.http_429_total?.values?.count ?? 0,
      http5xx: m.http_5xx_total?.values?.count ?? 0,
      http401: m.http_401_total?.values?.count ?? 0,
      netErrors: m.http_net_error_total?.values?.count ?? 0,
    },
    thresholds,
    allThresholdsPassed,
  };

  const jsonText = `${JSON.stringify(summary, null, 2)}\n`;
  const lines = [
    '',
    '========================================================================================',
    ` MEOW R5 PRODUCTION READINESS — ${summary.stageLabel}`,
    '========================================================================================',
    ` Peak VUs: ${summary.measuredPeakVus} (target ${summary.targetPeakVus}) | Reqs: ${summary.throughput.totalRequests} (${summary.throughput.requestsPerSec} req/s) | Duration: ${summary.durationSec}s`,
    ` Read API:  p50=${summary.latency.readApi?.p50Ms ?? 'n/a'}ms  p95=${summary.latency.readApi?.p95Ms ?? 'n/a'}ms  p99=${summary.latency.readApi?.p99Ms ?? 'n/a'}ms  max=${summary.latency.readApi?.maxMs ?? 'n/a'}ms`,
    ` Write API: p50=${summary.latency.writeApi?.p50Ms ?? 'n/a'}ms  p95=${summary.latency.writeApi?.p95Ms ?? 'n/a'}ms  p99=${summary.latency.writeApi?.p99Ms ?? 'n/a'}ms  max=${summary.latency.writeApi?.maxMs ?? 'n/a'}ms`,
    ` HTTP Fail: ${summary.throughput.httpFailedPct}% (${summary.throughput.httpFailedCount}) | Checks: ${summary.throughput.checksPassPct}% | Journey OK: ${summary.throughput.journeySuccessPct}%`,
    ` Journeys:  auth=${summary.journeys.auth} browse=${summary.journeys.browseAndQuestions} quiz=${summary.journeys.quizSession} mock=${summary.journeys.mockTest} training/lb=${summary.journeys.trainingLeaderboardsStats}`,
    ` Integrity: quizFailures=${summary.integrity.quizJourneyFailures} dupSubmits=${summary.integrity.duplicateSubmissions} leaks=${summary.integrity.answerKeyLeaks} replaysVerified=${summary.integrity.replaysVerified}`,
    ` Errors:    429=${summary.errors.http429} 5xx=${summary.errors.http5xx} 401=${summary.errors.http401} net=${summary.errors.netErrors}`,
    ` Verdict:   ${summary.allThresholdsPassed ? 'PASS' : 'THRESHOLD BREACH'}`,
    '========================================================================================',
    '',
  ].join('\n');

  const out = { stdout: lines };
  if (config.summaryPath) {
    out[config.summaryPath] = jsonText;
  }
  return out;
}
