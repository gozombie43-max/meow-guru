import http from 'k6/http';
import { check } from 'k6';
import { loadConfig, splitStages } from './config/environment.js';
import { initAuthPool } from './helpers/auth.js';
import {
  createSummaryHandler,
  recordPrometheusSetup,
  recordPrometheusTeardown,
  scrapePrometheusMetrics,
} from './helpers/reporting.js';
import { buildThresholds, prometheusGauges } from './helpers/thresholds.js';
import { runLegacyQuestionDelivery } from './scenarios/question-delivery.js';
import { runQuizSessionJourney } from './scenarios/quiz-session.js';

// ============================================================================
// Meow Question Delivery — Modular Backwards-Compatible Entrypoint
// ============================================================================
// Preserves legacy CLI/env contract (STAGE=smoke|stage0|stage1..stage7|ramp,
// QUIZ_MODE, REDIS_MODE, LEGACY_ENABLED, LEGACY_RATIO, BATCH_SIZE,
// LEGACY_LIMIT, METRICS_TOKEN, SUMMARY_OUTPUT) while delegating to the
// modular k6 architecture under config/, helpers/, and scenarios/.

const config = loadConfig(undefined, {
  scenarioName: 'meow-question-delivery',
  defaultProfile: 'smoke',
});

function buildScenarios() {
  const primaryFraction = config.legacyEnabled ? 1 - config.legacyRatio : 1;
  const scenarios = {
    quiz_taker_journey: {
      executor: 'ramping-vus',
      exec: 'quizTakerJourney',
      startVUs: 0,
      stages: splitStages(config.profile.stages, primaryFraction, true),
      gracefulRampDown: '30s',
      tags: {
        scenario_role: 'v1_quiz_journey',
        redis_mode: config.redisMode,
        stage: config.profileName,
        env: config.envName,
      },
    },
  };

  if (config.legacyEnabled) {
    scenarios.legacy_readonly_compat = {
      executor: 'ramping-vus',
      exec: 'legacyReadOnlyJourney',
      startVUs: 0,
      stages: splitStages(config.profile.stages, config.legacyRatio, true),
      gracefulRampDown: '20s',
      tags: {
        scenario_role: 'legacy_readonly',
        redis_mode: config.redisMode,
        stage: config.profileName,
        env: config.envName,
      },
    };
  }

  return scenarios;
}

export const options = {
  scenarios: buildScenarios(),
  tags: {
    redis_mode: config.redisMode,
    stage: config.profileName,
    env: config.envName,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: buildThresholds({
    profileName: config.profileName,
    strictSlo: config.strictSlo,
    includeQuizSession: true,
    includeLegacy: config.legacyEnabled,
    includeJourneyRate: true,
  }),
};

export function setup() {
  const healthRes = http.get(`${config.baseUrl}/api/health`, {
    tags: {
      endpoint: 'health_check',
      redis_mode: config.redisMode,
      stage: config.profileName,
    },
  });
  check(healthRes, {
    'setup: /api/health returns 200': (r) => r.status === 200,
  });

  const auth = initAuthPool(config, { requireAuth: true });
  const beforeMetrics = scrapePrometheusMetrics(http, config, 'before');
  recordPrometheusSetup(prometheusGauges, beforeMetrics);

  return {
    ...auth,
    beforeMetrics,
    startedAt: new Date().toISOString(),
  };
}

export function teardown(data) {
  recordPrometheusTeardown(prometheusGauges, data, http, config);
}

export function quizTakerJourney(data) {
  runQuizSessionJourney(data, config);
}

export function legacyReadOnlyJourney(data) {
  runLegacyQuestionDelivery(data, config);
}

export default function (data) {
  runQuizSessionJourney(data, config);
}

export const handleSummary = createSummaryHandler(config, {
  scenarioName: 'meow-question-delivery',
});
