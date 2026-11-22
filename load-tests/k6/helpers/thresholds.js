import { Counter, Gauge, Rate, Trend } from 'k6/metrics';
import { classifyHttpResponse } from './data.js';
import { ENDPOINT_SAMPLE_COUNTER_MAP } from './thresholds-constants.js';

export { ENDPOINT_SAMPLE_COUNTER_MAP };

// ============================================================================
// Centralized k6 Custom Metrics
// ============================================================================

// Integrity & error-classification counters
export const duplicateQuestionsTotal = new Counter('duplicate_questions_total');
export const answerKeyLeaksTotal = new Counter('answer_key_leaks_total');
export const failedAnswerSubmissionsTotal = new Counter('failed_answer_submissions_total');
export const unexpectedAuthFailuresTotal = new Counter('unexpected_auth_failures_total');
export const unhandled5xxTotal = new Counter('unhandled_5xx_total');
export const rateLimit429Total = new Counter('rate_limit_429_total');
export const businessErrorsTotal = new Counter('business_errors_total');
export const infraErrorsTotal = new Counter('infra_errors_total');

// Sample & throughput counters (paired with endpoint Trends for zero-sample detection)
export const sessionsCreatedTotal = new Counter('sessions_created_total');
export const sessionsCompletedTotal = new Counter('sessions_completed_total');
export const answersSubmittedTotal = new Counter('answers_submitted_total');
export const prefetchBatchesTotal = new Counter('prefetch_batches_total');
export const idempotentReplaysVerifiedTotal = new Counter('idempotent_replays_verified_total');
export const questionsBatchRequestsTotal = new Counter('questions_batch_requests_total');
export const sessionCreateRequestsTotal = new Counter('session_create_requests_total');
export const answerSubmitRequestsTotal = new Counter('answer_submit_requests_total');
export const sessionSubmitRequestsTotal = new Counter('session_submit_requests_total');
export const sessionResultRequestsTotal = new Counter('session_result_requests_total');
export const legacyMetaRequestsTotal = new Counter('legacy_meta_requests_total');
export const legacySessionRequestsTotal = new Counter('legacy_session_requests_total');
export const healthChecksTotal = new Counter('health_checks_total');
export const authJourneysTotal = new Counter('auth_journeys_total');
export const progressRequestsTotal = new Counter('progress_requests_total');

// Per-endpoint & per-scenario latency/payload Trends
export const sessionCreateDurationMs = new Trend('session_create_duration_ms', true);
export const questionsBatchDurationMs = new Trend('questions_batch_duration_ms', true);
export const answerSubmitDurationMs = new Trend('answer_submit_duration_ms', true);
export const sessionSubmitDurationMs = new Trend('session_submit_duration_ms', true);
export const sessionResultDurationMs = new Trend('session_result_duration_ms', true);
export const legacySessionDurationMs = new Trend('legacy_session_duration_ms', true);
export const legacyMetaDurationMs = new Trend('legacy_meta_duration_ms', true);
export const authLoginDurationMs = new Trend('auth_login_duration_ms', true);
export const healthDurationMs = new Trend('health_duration_ms', true);
export const userProgressDurationMs = new Trend('user_progress_duration_ms', true);
export const questionsBatchPayloadBytes = new Trend('questions_batch_payload_bytes', false);

// Journey success rate
export const journeySuccessRate = new Rate('journey_success_rate');

// Prometheus `/metrics` scrape Gauges populated in setup() / teardown()
export const scrapedMetricsAvailable = new Gauge('meow_scraped_metrics_available');
export const scrapedCacheHitRatio = new Gauge('meow_scraped_cache_hit_ratio');
export const scrapedRedisHitRatio = new Gauge('meow_scraped_redis_hit_ratio');
export const scrapedCacheHitsDelta = new Gauge('meow_scraped_cache_hits_delta');
export const scrapedCacheMissesDelta = new Gauge('meow_scraped_cache_misses_delta');
export const scrapedRedisHitsDelta = new Gauge('meow_scraped_redis_hits_delta');
export const scrapedRedisMissesDelta = new Gauge('meow_scraped_redis_misses_delta');
export const scrapedMongoPoolWaitingBefore = new Gauge('meow_scraped_mongo_pool_waiting_before');
export const scrapedMongoPoolWaitingAfter = new Gauge('meow_scraped_mongo_pool_waiting_after');
export const scrapedMongoCommandsDelta = new Gauge('meow_scraped_mongo_commands_delta');
export const scrapedRedisFallbacksDelta = new Gauge('meow_scraped_redis_fallbacks_delta');

export const prometheusGauges = {
  scrapedMetricsAvailable,
  scrapedCacheHitRatio,
  scrapedRedisHitRatio,
  scrapedCacheHitsDelta,
  scrapedCacheMissesDelta,
  scrapedRedisHitsDelta,
  scrapedRedisMissesDelta,
  scrapedMongoPoolWaitingBefore,
  scrapedMongoPoolWaitingAfter,
  scrapedMongoCommandsDelta,
  scrapedRedisFallbacksDelta,
};

export function recordHttpOutcome(res, tags = {}, allowedBusinessStatuses = []) {
  const classification = classifyHttpResponse(res, allowedBusinessStatuses);
  if (classification.isOk) return classification;

  const metricTags = { ...tags, status: String(classification.status) };
  if (classification.isUnhandled5xx) {
    unhandled5xxTotal.add(1, metricTags);
  }
  if (classification.isRateLimited) {
    rateLimit429Total.add(1, metricTags);
  }
  if (classification.isBusinessError) {
    businessErrorsTotal.add(1, metricTags);
  }
  if (classification.isInfraError) {
    infraErrorsTotal.add(1, metricTags);
  }
  return classification;
}

export function buildThresholds(options = {}) {
  const {
    strictSlo = false,
    activeEndpoints = [],
    includeQuizSession = false,
    includeLegacy = false,
    includeHealth = false,
    includeAuth = false,
    includeProgress = false,
    includeJourneyRate = true,
  } = options;

  const activeSet = new Set(Array.isArray(activeEndpoints) ? activeEndpoints : []);
  if (includeQuizSession) {
    activeSet.add('session_create');
    activeSet.add('questions_batch');
    activeSet.add('answer_submit');
    activeSet.add('session_submit');
    activeSet.add('session_result');
  }
  if (includeLegacy) {
    activeSet.add('legacy_questions_session');
    activeSet.add('legacy_meta');
  }
  if (includeHealth) {
    activeSet.add('health_check');
  }
  if (includeAuth) {
    activeSet.add('auth_login');
  }
  if (includeProgress) {
    activeSet.add('user_progress');
  }

  const thresholds = {
    http_req_failed: [strictSlo ? 'rate<0.001' : 'rate<0.01'],
    http_req_duration: ['p(99)<1000'],
    checks: ['rate>0.99'],
    unexpected_auth_failures_total: ['count==0'],
    unhandled_5xx_total: ['count==0'],
    duplicate_questions_total: ['count==0'],
    answer_key_leaks_total: ['count==0'],
    failed_answer_submissions_total: ['count==0'],
  };

  if (includeJourneyRate) {
    thresholds.journey_success_rate = ['rate>0.99'];
  }

  if (activeSet.has('questions_batch')) {
    thresholds['http_req_duration{endpoint:questions_batch}'] = strictSlo
      ? ['p(95)<200', 'p(99)<400']
      : ['p(95)<500', 'p(99)<1000'];
  }
  if (activeSet.has('session_create')) {
    thresholds['http_req_duration{endpoint:session_create}'] = strictSlo
      ? ['p(95)<250', 'p(99)<600']
      : ['p(95)<500', 'p(99)<1000'];
  }
  if (activeSet.has('legacy_questions_session')) {
    thresholds['http_req_duration{endpoint:legacy_questions_session}'] = ['p(95)<500', 'p(99)<1000'];
  }
  if (activeSet.has('health_check')) {
    thresholds['http_req_duration{endpoint:health_check}'] = ['p(95)<500', 'p(99)<1000'];
  }
  if (activeSet.has('user_progress')) {
    thresholds['http_req_duration{endpoint:user_progress}'] = ['p(95)<500', 'p(99)<1000'];
  }
  if (activeSet.has('auth_login')) {
    thresholds['http_req_duration{endpoint:auth_login}'] = ['p(95)<750', 'p(99)<1500'];
  }

  return thresholds;
}
