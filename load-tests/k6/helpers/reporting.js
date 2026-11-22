// ============================================================================
// Meow k6 Summary Reporting, Threshold Verification & Prometheus Scraping
// ============================================================================
// Pure ESM module with ZERO k6/* static imports (testable in Node.js).

import { ENDPOINT_SAMPLE_COUNTER_MAP } from './thresholds-constants.js';

const ZERO_ERROR_COUNTERS = new Set([
  'duplicate_questions_total',
  'answer_key_leaks_total',
  'failed_answer_submissions_total',
  'unexpected_auth_failures_total',
  'unhandled_5xx_total',
  'rate_limit_429_total',
  'infra_errors_total',
]);

function metricObj(data, name) {
  return data?.metrics?.[name] || null;
}

function metricValues(data, name) {
  return data?.metrics?.[name]?.values || null;
}

function round2(n) {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
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

// ============================================================================
// Prometheus `/metrics` Parser & Scraper
// ============================================================================
export function parseMetricLabels(rawLabels) {
  const labels = {};
  if (!rawLabels) return labels;
  const regex = /([a-zA-Z_][a-zA-Z0-9_]*)="((?:\\.|[^"\\])*)"/g;
  let match;
  while ((match = regex.exec(rawLabels)) !== null) {
    labels[match[1]] = match[2].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return labels;
}

export function parsePrometheusMetrics(text) {
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
    const match =
      /^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s+([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?|NaN|\+Inf|-Inf)/.exec(
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

export function computePrometheusDeltas(before, after) {
  if (!before || !after) return null;
  const delta = (key) => Math.max(0, (after[key] || 0) - (before[key] || 0));

  const l1Hits = delta('l1Hits') + delta('l1Stale');
  const redisHits = delta('redisHits') + delta('redisStale');
  const redisMisses = delta('redisMisses');
  const sourceMisses = delta('sourceMisses');
  const bypasses = delta('bypasses');

  const totalHits = l1Hits + redisHits;
  const totalReads = totalHits + sourceMisses + bypasses;
  const tieredCacheHitRatio = totalReads > 0 ? totalHits / totalReads : 0;

  const redisLookups = redisHits + redisMisses;
  const redisOnlyHitRatio = redisLookups > 0 ? redisHits / redisLookups : 0;

  return {
    tieredCacheHitRatio,
    redisOnlyHitRatio,
    totalHits,
    cacheMissesDelta: sourceMisses + bypasses,
    redisHits,
    redisMisses,
    mongoPoolWaitingBefore: before.mongoPoolWaiting || 0,
    mongoPoolWaitingAfter: after.mongoPoolWaiting || 0,
    mongoCommandsDelta: delta('mongoCommandsTotal'),
    redisFallbacksDelta: delta('redisFallbacksTotal'),
  };
}

export function scrapePrometheusMetrics(httpClient, config, phase) {
  if (!httpClient || !config?.metricsToken) return null;
  const expected =
    typeof httpClient.expectedStatuses === 'function' ? httpClient.expectedStatuses(200) : undefined;
  const res = httpClient.get(`${config.baseUrl}/metrics`, {
    headers: { Authorization: `Bearer ${config.metricsToken}` },
    tags: {
      endpoint: 'metrics_scrape',
      phase,
      redis_mode: config.redisMode,
      profile: config.profileName,
    },
    ...(expected ? { responseCallback: expected } : {}),
  });
  if (res.status !== 200) {
    console.warn(`[k6][metrics] GET /metrics (${phase}) returned HTTP ${res.status}`);
    return null;
  }
  return parsePrometheusMetrics(res.body);
}

export function recordPrometheusSetup(gauges, beforeMetrics) {
  if (!gauges) return;
  if (beforeMetrics) {
    gauges.scrapedMetricsAvailable.add(1);
    gauges.scrapedMongoPoolWaitingBefore.add(beforeMetrics.mongoPoolWaiting);
  } else {
    gauges.scrapedMetricsAvailable.add(0);
  }
}

export function recordPrometheusTeardown(gauges, data, httpClient, config) {
  if (!gauges || !data?.beforeMetrics) return;
  const afterMetrics = scrapePrometheusMetrics(httpClient, config, 'after');
  if (!afterMetrics) return;

  const deltas = computePrometheusDeltas(data.beforeMetrics, afterMetrics);
  if (!deltas) return;

  gauges.scrapedMetricsAvailable.add(1);
  gauges.scrapedCacheHitRatio.add(deltas.tieredCacheHitRatio);
  gauges.scrapedRedisHitRatio.add(deltas.redisOnlyHitRatio);
  gauges.scrapedCacheHitsDelta.add(deltas.totalHits);
  gauges.scrapedCacheMissesDelta.add(deltas.cacheMissesDelta);
  gauges.scrapedRedisHitsDelta.add(deltas.redisHits);
  gauges.scrapedRedisMissesDelta.add(deltas.redisMisses);
  gauges.scrapedMongoPoolWaitingBefore.add(deltas.mongoPoolWaitingBefore);
  gauges.scrapedMongoPoolWaitingAfter.add(deltas.mongoPoolWaitingAfter);
  gauges.scrapedMongoCommandsDelta.add(deltas.mongoCommandsDelta);
  gauges.scrapedRedisFallbacksDelta.add(deltas.redisFallbacksDelta);
}

// ============================================================================
// Zero-Sample Detection & Threshold Evaluation
// ============================================================================
function inferSampleCount(data, metricKey, pairedCounterKey) {
  if (pairedCounterKey) {
    const pairedVal = metricValues(data, pairedCounterKey);
    if (pairedVal && Number.isFinite(pairedVal.count)) {
      return pairedVal.count;
    }
    return 0;
  }

  const m = metricObj(data, metricKey);
  const v = m?.values;
  if (!v) return 0;

  if (metricKey === 'http_req_failed' || metricKey === 'http_req_duration') {
    return metricValues(data, 'http_reqs')?.count ?? 0;
  }
  if (m.type === 'rate' || ('passes' in v && 'fails' in v)) {
    return (v.passes || 0) + (v.fails || 0);
  }
  if (m.type === 'counter' || 'count' in v) {
    if (ZERO_ERROR_COUNTERS.has(metricKey)) {
      return metricValues(data, 'http_reqs')?.count ?? 0;
    }
    return v.count || 0;
  }
  // Trend without explicit count property in k6 summary JSON:
  const allZero = (v.min || 0) === 0 && (v.max || 0) === 0 && (v.avg || 0) === 0;
  return allZero ? 0 : 1;
}

export function evaluateThresholds(data, requiredMetrics = [], options = {}) {
  const httpReqsCount = metricValues(data, 'http_reqs')?.count ?? 0;
  const allowZeroSamples = Boolean(options.allowZeroSamples);

  const metricsToCheck = new Map();

  // Include all metrics that actually carry k6 thresholds
  for (const [key, metric] of Object.entries(data?.metrics || {})) {
    if (metric?.thresholds && Object.keys(metric.thresholds).length > 0) {
      metricsToCheck.set(key, {
        key,
        sampleCounter: ENDPOINT_SAMPLE_COUNTER_MAP[key] || null,
        optional: false,
      });
    }
  }

  // Merge explicitly required metrics
  for (const entry of requiredMetrics || []) {
    if (typeof entry === 'string') {
      const existing = metricsToCheck.get(entry);
      metricsToCheck.set(entry, {
        key: entry,
        sampleCounter: existing?.sampleCounter || ENDPOINT_SAMPLE_COUNTER_MAP[entry] || null,
        optional: false,
      });
    } else if (entry && typeof entry === 'object' && entry.key) {
      const existing = metricsToCheck.get(entry.key);
      metricsToCheck.set(entry.key, {
        key: entry.key,
        sampleCounter: entry.sampleCounter ?? existing?.sampleCounter ?? ENDPOINT_SAMPLE_COUNTER_MAP[entry.key] ?? null,
        optional: Boolean(entry.optional),
      });
    }
  }

  const evaluations = {};
  const failures = [];

  if (!allowZeroSamples && httpReqsCount === 0) {
    failures.push({
      metric: 'http_reqs',
      status: 'NO_SAMPLES',
      expression: 'count > 0',
      actual: 0,
      reason: 'NO_SAMPLES: 0 HTTP requests were executed during the test run',
    });
  }

  for (const [key, spec] of metricsToCheck.entries()) {
    const metric = metricObj(data, key);
    const sampleCount = inferSampleCount(data, key, spec.sampleCounter);

    if (!metric) {
      if (spec.optional) {
        evaluations[key] = { status: 'SKIPPED', sampleCount: 0, passed: true, checks: [] };
        continue;
      }
      evaluations[key] = { status: 'NO_SAMPLES', sampleCount: 0, passed: false, checks: [] };
      failures.push({
        metric: key,
        status: 'NO_SAMPLES',
        expression: 'present with samples',
        actual: null,
        reason: `NO_SAMPLES: Required metric "${key}" was not recorded`,
      });
      continue;
    }

    const thresholdResults = Object.entries(metric.thresholds || {}).map(([expr, res]) => ({
      expression: expr,
      ok: Boolean(res?.ok),
    }));

    const hasZeroSamples = !allowZeroSamples && !spec.optional && !ZERO_ERROR_COUNTERS.has(key) && sampleCount === 0;
    if (hasZeroSamples) {
      evaluations[key] = {
        status: 'NO_SAMPLES',
        sampleCount: 0,
        passed: false,
        checks: thresholdResults,
      };
      failures.push({
        metric: key,
        status: 'NO_SAMPLES',
        expression: thresholdResults.map((c) => c.expression).join(', ') || 'samples > 0',
        actual: 0,
        reason: `NO_SAMPLES: Metric "${key}" recorded 0 samples (cannot pass with empty data)`,
      });
      continue;
    }

    const failedExprs = thresholdResults.filter((c) => !c.ok);
    if (failedExprs.length > 0) {
      evaluations[key] = {
        status: 'FAIL',
        sampleCount,
        passed: false,
        checks: thresholdResults,
      };
      for (const f of failedExprs) {
        failures.push({
          metric: key,
          status: 'FAIL',
          expression: f.expression,
          actual: metric.values,
          reason: `Threshold "${key}" failed (${f.expression})`,
        });
      }
    } else {
      evaluations[key] = {
        status: 'PASS',
        sampleCount,
        passed: true,
        checks: thresholdResults,
      };
    }
  }

  return {
    httpReqsCount,
    evaluations,
    failures,
    allPassed: failures.length === 0,
  };
}

function extractTrendStats(values, sampleCount = null) {
  if (!values) return null;
  return {
    sampleCount,
    avgMs: round2(values.avg),
    p50Ms: round2(values.med),
    p90Ms: round2(values['p(90)']),
    p95Ms: round2(values['p(95)']),
    p99Ms: round2(values['p(99)']),
    maxMs: round2(values.max),
  };
}

// ============================================================================
// Structured Report Builder & Human Formatter
// ============================================================================
export function buildSummaryReport(data, config = {}, options = {}) {
  const requiredMetrics = options.requiredMetrics || [];
  const evalResult = evaluateThresholds(data, requiredMetrics, options);

  const reqsTotal = metricValues(data, 'http_reqs');
  const reqFailed = metricValues(data, 'http_req_failed');
  const checksVal = metricValues(data, 'checks');
  const vusMax = metricValues(data, 'vus_max');
  const batchBytes = metricValues(data, 'questions_batch_payload_bytes');
  const journeyRateVal = metricValues(data, 'journey_success_rate');

  const totalRequests = reqsTotal?.count ?? 0;
  const rps = round2(reqsTotal?.rate) ?? 0;
  const httpFailedRate = reqFailed?.rate ?? (totalRequests === 0 ? 1 : 0);

  let checkSuccessRate = null;
  if (checksVal) {
    const passes = checksVal.passes || 0;
    const fails = checksVal.fails || 0;
    const totalChecks = passes + fails;
    if (totalChecks > 0) {
      checkSuccessRate = passes / totalChecks;
    } else if (Number.isFinite(checksVal.rate)) {
      checkSuccessRate = checksVal.rate;
    }
  }

  const dupCount = metricValues(data, 'duplicate_questions_total')?.count || 0;
  const leakCount = metricValues(data, 'answer_key_leaks_total')?.count || 0;
  const failedAnsCount = metricValues(data, 'failed_answer_submissions_total')?.count || 0;
  const unexpectedAuthFailures = metricValues(data, 'unexpected_auth_failures_total')?.count || 0;
  const unhandled5xx = metricValues(data, 'unhandled_5xx_total')?.count || 0;
  const rateLimit429 = metricValues(data, 'rate_limit_429_total')?.count || 0;
  const businessErrors = metricValues(data, 'business_errors_total')?.count || 0;
  const infraErrors = metricValues(data, 'infra_errors_total')?.count || 0;

  const sessionsCreated = metricValues(data, 'sessions_created_total')?.count || 0;
  const sessionsCompleted = metricValues(data, 'sessions_completed_total')?.count || 0;
  const answersSubmitted = metricValues(data, 'answers_submitted_total')?.count || 0;
  const prefetchBatches = metricValues(data, 'prefetch_batches_total')?.count || 0;
  const replaysVerified = metricValues(data, 'idempotent_replays_verified_total')?.count || 0;
  const failedJourneys = journeyRateVal?.fails || 0;
  const journeySuccessRate = Number.isFinite(journeyRateVal?.rate)
    ? journeyRateVal.rate
    : journeyRateVal && (journeyRateVal.passes || 0) + (journeyRateVal.fails || 0) > 0
      ? (journeyRateVal.passes || 0) / ((journeyRateVal.passes || 0) + (journeyRateVal.fails || 0))
      : null;

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

  const sampleCountFor = (key) => metricValues(data, key)?.count ?? null;

  const endpointLatency = {
    questionsBatch: extractTrendStats(
      metricValues(data, 'http_req_duration{endpoint:questions_batch}') ||
        metricValues(data, 'questions_batch_duration_ms'),
      sampleCountFor('questions_batch_requests_total'),
    ),
    sessionCreate: extractTrendStats(
      metricValues(data, 'http_req_duration{endpoint:session_create}') ||
        metricValues(data, 'session_create_duration_ms'),
      sampleCountFor('session_create_requests_total'),
    ),
    answerSubmit: extractTrendStats(
      metricValues(data, 'answer_submit_duration_ms'),
      sampleCountFor('answer_submit_requests_total'),
    ),
    sessionSubmit: extractTrendStats(
      metricValues(data, 'session_submit_duration_ms'),
      sampleCountFor('session_submit_requests_total'),
    ),
    sessionResult: extractTrendStats(
      metricValues(data, 'session_result_duration_ms'),
      sampleCountFor('session_result_requests_total'),
    ),
    legacyQuestionsSession: extractTrendStats(
      metricValues(data, 'http_req_duration{endpoint:legacy_questions_session}') ||
        metricValues(data, 'legacy_session_duration_ms'),
      sampleCountFor('legacy_session_requests_total'),
    ),
    legacyQuestionsMeta: extractTrendStats(
      metricValues(data, 'legacy_meta_duration_ms'),
      sampleCountFor('legacy_meta_requests_total'),
    ),
    authLogin: extractTrendStats(
      metricValues(data, 'http_req_duration{endpoint:auth_login}') ||
        metricValues(data, 'auth_login_duration_ms'),
      sampleCountFor('auth_journeys_total'),
    ),
    healthCheck: extractTrendStats(
      metricValues(data, 'http_req_duration{endpoint:health_check}') ||
        metricValues(data, 'health_duration_ms'),
      sampleCountFor('health_checks_total'),
    ),
    userProgress: extractTrendStats(
      metricValues(data, 'http_req_duration{endpoint:user_progress}') ||
        metricValues(data, 'user_progress_duration_ms'),
      sampleCountFor('progress_requests_total'),
    ),
    overallHttp: extractTrendStats(metricValues(data, 'http_req_duration'), totalRequests),
  };

  // Determine hard failures vs soft warnings
  const failureReasons = evalResult.failures.map((f) => f.reason);
  if (unexpectedAuthFailures > 0 && !failureReasons.some((r) => r.includes('unexpected_auth_failures'))) {
    failureReasons.push(`Unexpected auth failures detected (${unexpectedAuthFailures})`);
  }
  if (unhandled5xx > 0 && !failureReasons.some((r) => r.includes('unhandled_5xx'))) {
    failureReasons.push(`Unhandled HTTP 5xx responses detected (${unhandled5xx})`);
  }
  if (dupCount > 0 && !failureReasons.some((r) => r.includes('duplicate_questions'))) {
    failureReasons.push(`Duplicate questions detected (${dupCount})`);
  }
  if (leakCount > 0 && !failureReasons.some((r) => r.includes('answer_key_leaks'))) {
    failureReasons.push(`Answer-key leaks detected (${leakCount})`);
  }
  if (failedAnsCount > 0 && !failureReasons.some((r) => r.includes('failed_answer_submissions'))) {
    failureReasons.push(`Failed answer submissions detected (${failedAnsCount})`);
  }
  if (journeySuccessRate !== null && journeySuccessRate < 0.99 && !failureReasons.some((r) => r.includes('journey_success_rate'))) {
    failureReasons.push(`Journey success rate ${fmtPct(journeySuccessRate)} below 99.00%`);
  }

  const warnings = [];
  if (config.metricsToken && !metricsScraped) {
    warnings.push('METRICS_TOKEN provided but /metrics scrape failed or was unavailable');
  } else if (!config.metricsToken && options.warnIfMetricsUnscraped) {
    warnings.push('Prometheus /metrics scrape skipped (METRICS_TOKEN not configured)');
  }
  if (metricsScraped && config.redisMode === 'enabled' && Number.isFinite(tieredCacheHitRatio) && tieredCacheHitRatio < 0.8) {
    warnings.push(`Tiered cache hit ratio ${fmtPct(tieredCacheHitRatio)} is below 80.00% target`);
  }
  if (rateLimit429 > 0 && failureReasons.length === 0) {
    warnings.push(`Rate limit HTTP 429 encountered (${rateLimit429})`);
  }

  let verdictStatus = 'PASS';
  if (failureReasons.length > 0) {
    verdictStatus = 'FAIL';
  } else if (warnings.length > 0) {
    verdictStatus = 'PASS WITH WARNINGS';
  }

  const durationMs = data?.state?.testRunDurationMs;
  const durationSec = Number.isFinite(durationMs) ? round2(durationMs / 1000) : null;

  return {
    schemaVersion: 2,
    timestamp: new Date().toISOString(),
    scenario: config.scenarioName || options.scenarioName || 'suite',
    profile: config.profileName || 'smoke',
    profileLabel: config.profile?.label || config.profileName || 'smoke',
    environment: config.envName || 'local',
    baseUrl: config.baseUrl || '',
    redisMode: config.redisMode || 'enabled',
    durationSec,
    peakVus: vusMax?.max ?? 0,
    totalRequests,
    rps,
    httpFailedRate,
    checkSuccessRate,
    failedJourneys,
    config: {
      baseUrl: config.baseUrl || '',
      envName: config.envName || 'local',
      profile: config.profileName || 'smoke',
      profileLabel: config.profile?.label || config.profileName || 'smoke',
      redisMode: config.redisMode || 'enabled',
      batchSize: config.batchSize ?? 20,
      legacyLimit: config.legacyLimit ?? 25,
      legacyEnabled: Boolean(config.legacyEnabled),
      examMode: config.examMode || null,
      topic: config.topic || null,
      subject: config.subject || null,
      thinkTimeScale: config.thinkTimeScale ?? 1,
    },
    verdict: {
      status: verdictStatus,
      passed: verdictStatus !== 'FAIL',
      reasons: verdictStatus === 'FAIL' ? failureReasons : warnings,
    },
    thresholdFailures: evalResult.failures,
    thresholdEvaluations: evalResult.evaluations,
    warnings,
    throughput: {
      peakVus: vusMax?.max ?? 0,
      totalRequests,
      requestsPerSec: rps,
      httpFailedRate,
      checkSuccessRate,
      failedJourneys,
      sessionsCreated,
      sessionsCompleted,
      answersSubmitted,
      prefetchBatches,
      idempotentReplaysVerified: replaysVerified,
      avgBatchPayloadBytes: round2(batchBytes?.avg),
      maxBatchPayloadBytes: round2(batchBytes?.max),
    },
    endpointLatency,
    latency: endpointLatency,
    integrity: {
      duplicateQuestionsTotal: dupCount,
      answerKeyLeaksTotal: leakCount,
      failedAnswerSubmissionsTotal: failedAnsCount,
      unexpectedAuthFailuresTotal: unexpectedAuthFailures,
      unhandled5xxTotal: unhandled5xx,
      rateLimit429Total: rateLimit429,
      businessErrorsTotal: businessErrors,
      infraErrorsTotal: infraErrors,
      journeySuccessRate,
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
          cacheHitTargetMet:
            config.redisMode === 'enabled' ? (tieredCacheHitRatio ?? 0) >= 0.8 : null,
        }
      : {
          scraped: false,
          reason: 'METRICS_TOKEN not provided or /metrics unreachable',
        },
  };
}

export function formatHumanSummary(report) {
  const divider = '='.repeat(106);
  const subDivider = '-'.repeat(106);
  const evals = report.thresholdEvaluations || {};
  const lat = report.endpointLatency || {};
  const integ = report.integrity || {};
  const tp = report.throughput || {};

  const statusFor = (metricKey, stats) => {
    if (evals[metricKey]?.status) return evals[metricKey].status;
    return stats && (stats.sampleCount ?? 0) > 0 ? 'INFO' : 'NO_DATA';
  };

  const rows = [
    ['GET /v1/sessions/:id/questions', lat.questionsBatch, statusFor('http_req_duration{endpoint:questions_batch}', lat.questionsBatch)],
    ['POST /v1/quiz/sessions', lat.sessionCreate, statusFor('http_req_duration{endpoint:session_create}', lat.sessionCreate)],
    ['POST /v1/sessions/:id/answers', lat.answerSubmit, statusFor('answer_submit_duration_ms', lat.answerSubmit)],
    ['POST /v1/sessions/:id/submit', lat.sessionSubmit, statusFor('session_submit_duration_ms', lat.sessionSubmit)],
    ['GET /v1/sessions/:id/result', lat.sessionResult, statusFor('session_result_duration_ms', lat.sessionResult)],
    ['GET /questions/session (legacy)', lat.legacyQuestionsSession, statusFor('http_req_duration{endpoint:legacy_questions_session}', lat.legacyQuestionsSession)],
    ['GET /questions/meta (legacy)', lat.legacyQuestionsMeta, statusFor('legacy_meta_duration_ms', lat.legacyQuestionsMeta)],
    ['POST /auth/login', lat.authLogin, statusFor('http_req_duration{endpoint:auth_login}', lat.authLogin)],
    ['GET /api/health', lat.healthCheck, statusFor('http_req_duration{endpoint:health_check}', lat.healthCheck)],
    ['User Progress / Profile', lat.userProgress, statusFor('http_req_duration{endpoint:user_progress}', lat.userProgress)],
    ['ALL http_req_duration', lat.overallHttp, statusFor('http_req_duration', lat.overallHttp)],
  ].filter(([, stats, st]) => stats || st === 'NO_SAMPLES' || st === 'FAIL');

  const lines = [
    '',
    divider,
    ` MEOW K6 LOAD TEST SUMMARY — ${report.profileLabel} [${report.scenario}]`,
    divider,
    ` Env: ${report.environment} | Target: ${report.baseUrl} | Date: ${report.timestamp} | Duration: ${report.durationSec ?? 'n/a'}s`,
    ` Peak VUs: ${fmtCount(report.peakVus)} | Total HTTP Reqs: ${fmtCount(report.totalRequests)} (${report.rps} req/s) | HTTP Fail: ${fmtPct(report.httpFailedRate)} | Checks: ${fmtPct(report.checkSuccessRate)}`,
    ` Failed Journeys: ${fmtCount(report.failedJourneys)} | Sessions Completed: ${fmtCount(tp.sessionsCompleted)} | Answers: ${fmtCount(tp.answersSubmitted)} | Prefetches: ${fmtCount(tp.prefetchBatches)} | Replays: ${fmtCount(tp.idempotentReplaysVerified)}`,
    subDivider,
    ` ${padRight('Endpoint', 32)} ${padLeft('Samples', 8)} ${padLeft('P50', 9)} ${padLeft('P90', 9)} ${padLeft('P95', 9)} ${padLeft('P99', 9)} ${padLeft('Max', 9)}  Status`,
    subDivider,
  ];

  for (const [label, stats, status] of rows) {
    lines.push(
      ` ${padRight(label, 32)} ${padLeft(fmtCount(stats?.sampleCount), 8)} ${padLeft(fmtMs(stats?.p50Ms), 9)} ${padLeft(fmtMs(stats?.p90Ms), 9)} ${padLeft(fmtMs(stats?.p95Ms), 9)} ${padLeft(fmtMs(stats?.p99Ms), 9)} ${padLeft(fmtMs(stats?.maxMs), 9)}  ${status}`,
    );
  }

  lines.push(subDivider);
  lines.push(' INTEGRITY & ERROR CLASSIFICATION');
  lines.push(
    `   duplicates=${fmtCount(integ.duplicateQuestionsTotal)} | answerKeyLeaks=${fmtCount(integ.answerKeyLeaksTotal)} | failedAnswers=${fmtCount(integ.failedAnswerSubmissionsTotal)} | authFailures=${fmtCount(integ.unexpectedAuthFailuresTotal)}`,
  );
  lines.push(
    `   unhandled5xx=${fmtCount(integ.unhandled5xxTotal)} | rateLimit429=${fmtCount(integ.rateLimit429Total)} | businessErrors=${fmtCount(integ.businessErrorsTotal)} | infraErrors=${fmtCount(integ.infraErrorsTotal)}`,
  );

  if (report.prometheusMetrics?.scraped) {
    const pm = report.prometheusMetrics;
    lines.push(subDivider);
    lines.push(' PROMETHEUS /metrics DELTA');
    lines.push(
      `   Tiered Cache Hit Ratio: ${pm.tieredCacheHitRatio}% (hits=${pm.cacheHitsDelta}, misses=${pm.cacheMissesDelta}) | Redis Hit Ratio: ${pm.redisLayerHitRatio}% (fallbacks=${pm.redisFallbacksDelta})`,
    );
    lines.push(
      `   Mongo Pool Waiting: ${pm.mongoPoolWaitingBefore} -> ${pm.mongoPoolWaitingAfter} | Mongo Commands Delta: ${pm.mongoCommandsDelta}`,
    );
  }

  if (report.thresholdFailures?.length > 0) {
    lines.push(subDivider);
    lines.push(' THRESHOLD FAILURES');
    for (const failure of report.thresholdFailures) {
      lines.push(`   [FAIL] ${failure.reason}`);
    }
  }

  if (report.warnings?.length > 0) {
    lines.push(subDivider);
    lines.push(' WARNINGS');
    for (const warning of report.warnings) {
      lines.push(`   [WARN] ${warning}`);
    }
  }

  lines.push(divider);
  lines.push(` VERDICT: ${report.verdict?.status || 'FAIL'}`);
  if (report.verdict?.reasons?.length > 0) {
    lines.push(` REASONS: ${report.verdict.reasons.join(' ; ')}`);
  }
  lines.push(divider);
  lines.push('');

  return lines.join('\n');
}

export function createSummaryHandler(config = {}, options = {}) {
  return function handleSummary(data) {
    const report = buildSummaryReport(data, config, options);
    const humanText = formatHumanSummary(report);
    const jsonText = JSON.stringify(report, null, 2);

    const reportsDir = String(config.reportsDir || 'load-tests/k6/reports').replace(/\/+$/, '');
    const scenarioSlug = String(config.scenarioName || options.scenarioName || 'suite').replace(/[^a-zA-Z0-9_-]/g, '-');
    const profileSlug = String(config.profileName || 'smoke').replace(/[^a-zA-Z0-9_-]/g, '-');
    const envSlug = String(config.envName || 'local').replace(/[^a-zA-Z0-9_-]/g, '-');
    const baseFilename = `${reportsDir}/${scenarioSlug}-${profileSlug}-${envSlug}`;

    const outputs = {
      stdout: humanText,
      [`${baseFilename}.json`]: jsonText,
      [`${baseFilename}.txt`]: humanText,
    };

    if (config.summaryOutputPath) {
      outputs[config.summaryOutputPath] = jsonText;
    }

    return outputs;
  };
}
