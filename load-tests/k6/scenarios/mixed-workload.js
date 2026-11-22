import http from 'k6/http';
import { check } from 'k6';
import { loadConfig, splitStages } from '../config/environment.js';
import { getTrustedOrigin, initAuthPool } from '../helpers/auth.js';
import {
  createSummaryHandler,
  recordPrometheusSetup,
  recordPrometheusTeardown,
  scrapePrometheusMetrics,
} from '../helpers/reporting.js';
import { buildThresholds, prometheusGauges } from '../helpers/thresholds.js';
import { runAuthenticationScenario } from './authentication.js';
import { runHealthScenario } from './health.js';
import { runQuestionDeliveryScenario } from './question-delivery.js';
import { runQuizSessionJourney } from './quiz-session.js';
import { runUserProgressScenario } from './user-progress.js';

const config = loadConfig(undefined, { scenarioName: 'mixed-workload' });

function estimateTotalDuration(stages) {
  let totalSec = 0;
  for (const s of stages || []) {
    const raw = String(s.duration || '').trim().toLowerCase();
    const m = /^(\d+(?:\.\d+)?)([smh])$/.exec(raw);
    if (!m) continue;
    const val = Number.parseFloat(m[1]);
    if (m[2] === 's') totalSec += val;
    else if (m[2] === 'm') totalSec += val * 60;
    else if (m[2] === 'h') totalSec += val * 3600;
  }
  return `${Math.max(10, Math.round(totalSec))}s`;
}

function buildMixedScenarios() {
  const scenarios = {
    quiz_session: {
      executor: 'ramping-vus',
      exec: 'quizSessionWorkload',
      startVUs: 0,
      stages: splitStages(config.profile.stages, 0.55, true),
      gracefulRampDown: '30s',
      tags: { scenario_role: 'quiz_session', env: config.envName, profile: config.profileName },
    },
    question_delivery: {
      executor: 'ramping-vus',
      exec: 'questionDeliveryWorkload',
      startVUs: 0,
      stages: splitStages(config.profile.stages, 0.25, true),
      gracefulRampDown: '20s',
      tags: { scenario_role: 'question_delivery', env: config.envName, profile: config.profileName },
    },
    user_progress: {
      executor: 'ramping-vus',
      exec: 'userProgressWorkload',
      startVUs: 0,
      stages: splitStages(config.profile.stages, 0.15, true),
      gracefulRampDown: '20s',
      tags: { scenario_role: 'user_progress', env: config.envName, profile: config.profileName },
    },
    health: {
      executor: 'ramping-vus',
      exec: 'healthWorkload',
      startVUs: 0,
      stages: splitStages(config.profile.stages, 0.05, true),
      gracefulRampDown: '10s',
      tags: { scenario_role: 'health', env: config.envName, profile: config.profileName },
    },
  };

  if (config.includeAuthScenario) {
    // Rate-capped auth cycle to stay safely below staging authLimiter (100 req/15m/IP).
    scenarios.authentication = {
      executor: 'constant-arrival-rate',
      exec: 'authWorkload',
      rate: 3,
      timeUnit: '1m',
      duration: estimateTotalDuration(config.profile.stages),
      preAllocatedVUs: 1,
      maxVUs: 2,
      tags: { scenario_role: 'authentication', env: config.envName, profile: config.profileName },
    };
  }

  return scenarios;
}

export const options = {
  scenarios: buildMixedScenarios(),
  tags: {
    scenario: 'mixed-workload',
    env: config.envName,
    profile: config.profileName,
    redis_mode: config.redisMode,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: buildThresholds({
    profileName: config.profileName,
    strictSlo: config.strictSlo,
    includeQuizSession: true,
    includeLegacy: true,
    includeProgress: true,
    includeHealth: true,
    includeAuth: config.includeAuthScenario,
    includeJourneyRate: true,
  }),
};

export function quizSessionWorkload(data) {
  runQuizSessionJourney(data, config);
}

export function questionDeliveryWorkload(data) {
  runQuestionDeliveryScenario(data, config);
}

export function userProgressWorkload(data) {
  runUserProgressScenario(data, config);
}

export function healthWorkload(data) {
  runHealthScenario(data, config);
}

export function authWorkload(data) {
  runAuthenticationScenario(data, config);
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
    origin: auth.origin || getTrustedOrigin(config),
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

export const handleSummary = createSummaryHandler(config, { scenarioName: 'mixed-workload' });
