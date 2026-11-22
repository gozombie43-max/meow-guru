import http from 'k6/http';
import { check, group, sleep } from 'k6';
import exec from 'k6/execution';
import { loadConfig } from '../config/environment.js';
import { authHeaders, getAuthToken, handleUnauthorized, initAuthPool } from '../helpers/auth.js';
import {
  buildQueryString,
  countAnswerKeyLeaks,
  getQuestionFilterParams,
  makeIdempotencyKey,
  pickOptionIndex,
  pickWeightedQuizMode,
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
  answerSubmitDurationMs,
  answerSubmitRequestsTotal,
  answersSubmittedTotal,
  buildThresholds,
  duplicateQuestionsTotal,
  failedAnswerSubmissionsTotal,
  idempotentReplaysVerifiedTotal,
  journeySuccessRate,
  prefetchBatchesTotal,
  prometheusGauges,
  questionsBatchDurationMs,
  questionsBatchPayloadBytes,
  questionsBatchRequestsTotal,
  recordHttpOutcome,
  sessionCreateDurationMs,
  sessionCreateRequestsTotal,
  sessionResultDurationMs,
  sessionResultRequestsTotal,
  sessionSubmitDurationMs,
  sessionSubmitRequestsTotal,
  sessionsCompletedTotal,
  sessionsCreatedTotal,
} from '../helpers/thresholds.js';

const config = loadConfig(undefined, { scenarioName: 'quiz-session' });

export const options = {
  scenarios: {
    quiz_session: {
      executor: 'ramping-vus',
      exec: 'default',
      startVUs: 0,
      stages: config.profile.stages,
      gracefulRampDown: '30s',
      tags: { scenario: 'quiz_session', env: config.envName, profile: config.profileName },
    },
  },
  tags: {
    scenario: 'quiz_session',
    env: config.envName,
    profile: config.profileName,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: buildThresholds({
    profileName: config.profileName,
    strictSlo: config.strictSlo,
    includeQuizSession: true,
    includeJourneyRate: true,
  }),
};

function thinkPause(minSec, maxSec, activeConfig) {
  if (activeConfig.thinkTimeScale <= 0) return;
  sleep(randomBetween(minSec, maxSec) * activeConfig.thinkTimeScale);
}

function sendAuthedPost(url, bodyStr, extraHeaders, tags, tokenState, data, activeConfig) {
  let res = http.post(url, bodyStr, {
    headers: authHeaders(tokenState.token, extraHeaders),
    tags,
  });
  if (res.status === 401) {
    const refreshed = handleUnauthorized(data, activeConfig);
    if (refreshed) {
      tokenState.token = refreshed;
      const retryHeaders = { ...extraHeaders };
      if (retryHeaders['Idempotency-Key'] && tags.endpoint === 'session_create') {
        retryHeaders['Idempotency-Key'] = makeIdempotencyKey('k6_create', {
          vu: exec.vu.idInTest,
          iter: exec.vu.iterationInScenario,
        });
      }
      res = http.post(url, bodyStr, {
        headers: authHeaders(tokenState.token, retryHeaders),
        tags,
      });
    }
  }
  return res;
}

function sendAuthedGet(url, tags, tokenState, data, activeConfig) {
  let res = http.get(url, {
    headers: authHeaders(tokenState.token),
    tags,
  });
  if (res.status === 401) {
    const refreshed = handleUnauthorized(data, activeConfig);
    if (refreshed) {
      tokenState.token = refreshed;
      res = http.get(url, {
        headers: authHeaders(tokenState.token),
        tags,
      });
    }
  }
  return res;
}

export function runQuizSessionJourney(data, activeConfig = config) {
  const tokenState = { token: getAuthToken(data, activeConfig) };
  const mode = pickWeightedQuizMode(activeConfig.quizMode);
  const isExamStyle = mode === 'mock' || mode === 'speed';
  const seenUids = new Set();
  const filters = getQuestionFilterParams(activeConfig);
  const vuCtx = { vu: exec.vu.idInTest, iter: exec.vu.iterationInScenario };
  let journeyOk = true;

  const createPayload = {
    mode,
    batchSize: activeConfig.batchSize,
    totalQuestions: Math.max(activeConfig.batchSize * 2, 40),
    lang: 'en',
    randomize: true,
    ...filters,
  };

  let sessionId = null;
  let batch1 = [];
  let nextCursor = null;
  let hasMore = false;

  group('01_session_create', () => {
    const createKey = makeIdempotencyKey('k6_create', vuCtx);
    const res = sendAuthedPost(
      `${activeConfig.baseUrl}/api/v1/quiz/sessions`,
      JSON.stringify(createPayload),
      { 'Idempotency-Key': createKey },
      {
        endpoint: 'session_create',
        mode,
        redis_mode: activeConfig.redisMode,
        profile: activeConfig.profileName,
      },
      tokenState,
      data,
      activeConfig,
    );

    sessionCreateRequestsTotal.add(1, { mode, redis_mode: activeConfig.redisMode });
    sessionCreateDurationMs.add(res.timings.duration, { mode, redis_mode: activeConfig.redisMode });
    recordHttpOutcome(res, { endpoint: 'session_create', mode });

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

    sessionsCreatedTotal.add(1, { mode });
    sessionId = body.sessionId;
    batch1 = Array.isArray(body.questions) ? body.questions : [];
    nextCursor = body.nextCursor || null;
    hasMore = Boolean(body.hasMore);

    const leaks = countAnswerKeyLeaks(batch1);
    if (leaks > 0) {
      answerKeyLeaksTotal.add(leaks, { endpoint: 'session_create', mode });
      journeyOk = false;
    }
    const dups = trackUniqueQuestions(batch1, seenUids);
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
    journeySuccessRate.add(false, { scenario: 'quiz_session' });
    thinkPause(0.5, 1.5, activeConfig);
    return;
  }

  const activeQuestions = batch1.slice();
  const prefetchTriggerIndex = Math.min(14, Math.max(0, batch1.length - 1));
  let prefetched = false;
  const maxAnswersToSubmit = batch1.length + 3;

  group('02_answer_and_prefetch', () => {
    for (let idx = 0; idx < activeQuestions.length && idx < maxAnswersToSubmit; idx++) {
      const q = activeQuestions[idx];
      if (!q?.questionUid) continue;

      thinkPause(0.25, 0.75, activeConfig);

      const submissionId = makeIdempotencyKey(`k6_ans_${idx}`, vuCtx);
      const answerChoice = pickOptionIndex(q);
      const timeTakenMs = Math.round(randomBetween(1200, 6500));
      const answerPayload = JSON.stringify({
        questionUid: q.questionUid,
        answer: answerChoice,
        timeTakenMs,
        submissionId,
      });

      const ansRes = sendAuthedPost(
        `${activeConfig.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/answers`,
        answerPayload,
        { 'Idempotency-Key': submissionId },
        {
          endpoint: 'answer_submit',
          mode,
          redis_mode: activeConfig.redisMode,
          profile: activeConfig.profileName,
        },
        tokenState,
        data,
        activeConfig,
      );

      answerSubmitRequestsTotal.add(1, { mode, redis_mode: activeConfig.redisMode });
      answerSubmitDurationMs.add(ansRes.timings.duration, { mode, redis_mode: activeConfig.redisMode });
      recordHttpOutcome(ansRes, { endpoint: 'answer_submit', mode });

      const ansBody = safeJson(ansRes);
      const accepted = ansRes.status === 200 && ansBody?.accepted === true;

      if (!accepted) {
        console.error(
          `[K6_ANSWER_FAILURE] status=${ansRes.status} mode=${mode} ` +
            `code=${String(ansBody?.code ?? 'none').slice(0, 80)} ` +
            `error=${String(ansBody?.error ?? ansBody?.message ?? 'No JSON error body')
              .replace(/[\r\n\t]/g, ' ')
              .slice(0, 180)}`,
        );
        failedAnswerSubmissionsTotal.add(1, { mode, status: String(ansRes.status) });
        journeyOk = false;
      } else {
        answersSubmittedTotal.add(1, { mode });
      }

      if (accepted && isExamStyle && ansBody?.evaluation !== undefined) {
        answerKeyLeaksTotal.add(1, { endpoint: 'answer_submit', mode });
        journeyOk = false;
      }

      check(ansRes, {
        'answer submit status is 200 & accepted': () => accepted,
        'exam mode does not leak evaluation pre-submit': () =>
          !isExamStyle || ansBody?.evaluation === undefined,
      });

      // 5% idempotent replay on Q1
      if (idx === 0 && accepted && Math.random() < 0.05) {
        const replayRes = sendAuthedPost(
          `${activeConfig.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/answers`,
          answerPayload,
          { 'Idempotency-Key': submissionId },
          {
            endpoint: 'answer_submit_replay',
            mode,
            redis_mode: activeConfig.redisMode,
            profile: activeConfig.profileName,
          },
          tokenState,
          data,
          activeConfig,
        );
        recordHttpOutcome(replayRes, { endpoint: 'answer_submit_replay', mode });
        const replayBody = safeJson(replayRes);
        if (replayRes.status === 200 && replayBody?.accepted === true) {
          idempotentReplaysVerifiedTotal.add(1, { mode });
        } else {
          console.error(
            `[K6_ANSWER_REPLAY_FAILURE] status=${replayRes.status} mode=${mode} ` +
              `code=${String(replayBody?.code ?? 'none').slice(0, 80)} ` +
              `error=${String(replayBody?.error ?? replayBody?.message ?? 'No JSON error body')
                .replace(/[\r\n\t]/g, ' ')
                .slice(0, 180)}`,
          );
          failedAnswerSubmissionsTotal.add(1, { mode, status: String(replayRes.status) });
          journeyOk = false;
        }
      }

      // Q15 Batch 2 cursor prefetch
      if (!prefetched && idx >= prefetchTriggerIndex && hasMore && nextCursor) {
        prefetched = true;
        const batchQuery = buildQueryString({
          cursor: nextCursor,
          batchSize: activeConfig.batchSize,
          lang: 'en',
        });
        const batchRes = sendAuthedGet(
          `${activeConfig.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/questions${batchQuery}`,
          {
            endpoint: 'questions_batch',
            mode,
            redis_mode: activeConfig.redisMode,
            profile: activeConfig.profileName,
          },
          tokenState,
          data,
          activeConfig,
        );
        questionsBatchRequestsTotal.add(1, { mode, redis_mode: activeConfig.redisMode });
        questionsBatchDurationMs.add(batchRes.timings.duration, { mode, redis_mode: activeConfig.redisMode });
        questionsBatchPayloadBytes.add(batchRes.body ? batchRes.body.length : 0, { mode });
        recordHttpOutcome(batchRes, { endpoint: 'questions_batch', mode });

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
          const dups = trackUniqueQuestions(batchBody.questions, seenUids);
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

  // Optional 20% mid-session status poll
  if (Math.random() < 0.2) {
    group('02b_session_poll', () => {
      const pollRes = sendAuthedGet(
        `${activeConfig.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}`,
        {
          endpoint: 'session_poll',
          mode,
          redis_mode: activeConfig.redisMode,
          profile: activeConfig.profileName,
        },
        tokenState,
        data,
        activeConfig,
      );
      recordHttpOutcome(pollRes, { endpoint: 'session_poll', mode });
      const pollBody = safeJson(pollRes);
      const pollOk = check(pollRes, {
        'session poll status is 200': (r) => r.status === 200,
        'session poll returns sessionId': () => pollBody?.sessionId === sessionId,
      });
      if (!pollOk) journeyOk = false;
    });
  }

  let submittedOk = false;
  group('03_session_submit', () => {
    const submitRes = sendAuthedPost(
      `${activeConfig.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/submit`,
      JSON.stringify({ reason: 'manual' }),
      { 'Idempotency-Key': makeIdempotencyKey('k6_submit', vuCtx) },
      {
        endpoint: 'session_submit',
        mode,
        redis_mode: activeConfig.redisMode,
        profile: activeConfig.profileName,
      },
      tokenState,
      data,
      activeConfig,
    );
    sessionSubmitRequestsTotal.add(1, { mode, redis_mode: activeConfig.redisMode });
    sessionSubmitDurationMs.add(submitRes.timings.duration, { mode, redis_mode: activeConfig.redisMode });
    recordHttpOutcome(submitRes, { endpoint: 'session_submit', mode });

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

  if (submittedOk) {
    group('04_session_result', () => {
      const resultRes = sendAuthedGet(
        `${activeConfig.baseUrl}/api/v1/quiz/sessions/${encodeURIComponent(sessionId)}/result`,
        {
          endpoint: 'session_result',
          mode,
          redis_mode: activeConfig.redisMode,
          profile: activeConfig.profileName,
        },
        tokenState,
        data,
        activeConfig,
      );
      sessionResultRequestsTotal.add(1, { mode, redis_mode: activeConfig.redisMode });
      sessionResultDurationMs.add(resultRes.timings.duration, { mode, redis_mode: activeConfig.redisMode });
      recordHttpOutcome(resultRes, { endpoint: 'session_result', mode });

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

  journeySuccessRate.add(journeyOk, { scenario: 'quiz_session' });
  thinkPause(0.5, 1.5, activeConfig);
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
  runQuizSessionJourney(data, config);
}

export function teardown(data) {
  recordPrometheusTeardown(prometheusGauges, data, http, config);
}

export const handleSummary = createSummaryHandler(config, { scenarioName: 'quiz-session' });
