import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { loadConfig } from '../config/environment.js';
import { randomBetween, safeJson } from '../helpers/data.js';
import {
  createSummaryHandler,
  recordPrometheusSetup,
  recordPrometheusTeardown,
  scrapePrometheusMetrics,
} from '../helpers/reporting.js';
import {
  buildThresholds,
  healthChecksTotal,
  healthDurationMs,
  journeySuccessRate,
  prometheusGauges,
  recordHttpOutcome,
} from '../helpers/thresholds.js';

const config = loadConfig(undefined, { scenarioName: 'health' });

export const options = {
  scenarios: {
    health: {
      executor: 'ramping-vus',
      exec: 'default',
      startVUs: 0,
      stages: config.profile.stages,
      gracefulRampDown: '10s',
      tags: { scenario: 'health', env: config.envName, profile: config.profileName },
    },
  },
  tags: {
    scenario: 'health',
    env: config.envName,
    profile: config.profileName,
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  thresholds: buildThresholds({
    profileName: config.profileName,
    strictSlo: config.strictSlo,
    includeHealth: true,
    includeJourneyRate: true,
  }),
};

export function runHealthScenario(_data, activeConfig = config) {
  let journeyOk = true;

  group('health_probes', () => {
    const liveRes = http.get(`${activeConfig.baseUrl}/live`, {
      tags: { scenario: 'health', endpoint: 'live', profile: activeConfig.profileName },
    });
    recordHttpOutcome(liveRes, { scenario: 'health', endpoint: 'live' });
    const liveBody = safeJson(liveRes);
    const liveOk = check(liveRes, {
      'GET /live status is 200': (r) => r.status === 200,
      'GET /live body.ok is true': () => liveBody?.ok === true,
    });
    if (!liveOk) journeyOk = false;

    const healthRes = http.get(`${activeConfig.baseUrl}/api/health`, {
      tags: { scenario: 'health', endpoint: 'health_check', profile: activeConfig.profileName },
    });
    healthChecksTotal.add(1, { scenario: 'health' });
    healthDurationMs.add(healthRes.timings.duration, { scenario: 'health' });
    recordHttpOutcome(healthRes, { scenario: 'health', endpoint: 'health_check' });

    const healthBody = safeJson(healthRes);
    const healthOk = check(healthRes, {
      'GET /api/health status is 200': (r) => r.status === 200,
      'GET /api/health body.ok is true': () => healthBody?.ok === true,
      'GET /api/health mongo is healthy': () => healthBody?.dependencies?.mongo === 'healthy',
      'GET /api/health state is ready': () => healthBody?.state === 'ready',
    });
    if (!healthOk) journeyOk = false;
  });

  journeySuccessRate.add(journeyOk, { scenario: 'health' });
  if (activeConfig.thinkTimeScale > 0) {
    sleep(randomBetween(0.2, 0.6) * activeConfig.thinkTimeScale);
  }
}

export function setup() {
  const beforeMetrics = scrapePrometheusMetrics(http, config, 'before');
  recordPrometheusSetup(prometheusGauges, beforeMetrics);
  return {
    beforeMetrics,
    startedAt: new Date().toISOString(),
  };
}

export default function (data) {
  runHealthScenario(data, config);
}

export function teardown(data) {
  recordPrometheusTeardown(prometheusGauges, data, http, config);
}

export const handleSummary = createSummaryHandler(config, { scenarioName: 'health' });
