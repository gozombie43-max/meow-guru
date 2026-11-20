import { Registry, Histogram, Counter, Gauge, collectDefaultMetrics } from '@prometheus-io/client';
import { randomUUID, timingSafeEqual } from 'node:crypto';

export const registry = new Registry();
const registers = [registry];
const metricsInstance = randomUUID();
collectDefaultMetrics({ register: registry, prefix: 'meow_' });
export const httpLatency = new Histogram({ name: 'meow_http_duration_seconds', help: 'API request duration', labelNames: ['method', 'route', 'operation'], buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.35, 0.5, 0.8, 1, 2, 5, 10], registers });
export const httpRequests = new Counter({ name: 'meow_http_requests_total', help: 'Completed API requests', labelNames: ['method', 'route', 'status'], registers });
export const dependencyLatency = new Histogram({ name: 'meow_dependency_duration_seconds', help: 'Dependency operation duration', labelNames: ['dependency', 'operation'], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 1, 5, 10], registers });
export const dependencyErrors = new Counter({ name: 'meow_dependency_errors_total', help: 'Dependency failures', labelNames: ['dependency'], registers });
export const mongoPoolWaiting = new Gauge({ name: 'meow_mongo_pool_waiting', help: 'Pending Mongo connection checkouts', registers });
export const mongoCommands = new Counter({ name: 'meow_mongo_commands_total', help: 'Actual Mongo driver command attempts, including retries', labelNames: ['collection', 'command', 'purpose', 'outcome'], registers });
export const mongoCommandLatency = new Histogram({ name: 'meow_mongo_command_duration_seconds', help: 'Mongo driver command duration by bounded collection and purpose', labelNames: ['collection', 'command', 'purpose', 'outcome'], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10], registers });
export const authRequests = new Counter({ name: 'meow_auth_validation_requests_total', help: 'Valid session validation callers before in-flight coalescing', registers });
export const battleMatchmakingDegraded = new Gauge({ name: 'meow_battle_matchmaking_degraded', help: 'Matchmaking using slower Mongo coordination because Redis is unavailable', registers });
export const battleMatchmakingLockAttempts = new Counter({ name: 'meow_battle_matchmaking_lock_attempts_total', help: 'Matchmaking coordinator lease attempts', labelNames: ['outcome'], registers });
export const authBurstLatency = new Histogram({ name: 'meow_auth_validation_burst_duration_seconds', help: 'Actual coalesced authorization work, including Mongo and Redis', labelNames: ['cache', 'outcome'], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10], registers });
export const redisCacheOversized = new Counter({ name: 'meow_redis_cache_oversized_total', help: 'Cache values bypassed for exceeding byte or traversal budgets', labelNames: ['format'], registers });
export const redisCacheValueBytes = new Histogram({ name: 'meow_redis_cache_value_bytes', help: 'Serialized cache value bytes', labelNames: ['format'], buckets: [1024, 16384, 65536, 262144, 524288, 1048576, 2097152], registers });
export const redisCircuitState = new Gauge({ name: 'meow_redis_circuit_state', help: 'Optional Redis circuit: 0 closed, 1 open, 2 half-open', registers });
export const redisCommandTimeouts = new Counter({ name: 'meow_redis_command_timeout_total', help: 'Redis connection or command timeouts', registers });
export const redisFallbacks = new Counter({ name: 'meow_redis_fallback_total', help: 'Redis bypasses during unavailable connections or open circuit', registers });
export const trainingCreateStageDuration = new Histogram({ name: 'meow_training_create_stage_duration_seconds', help: 'Training creation stage duration, including failed stages', labelNames: ['stage', 'outcome'], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 2, 5, 10], registers });
export const cacheOperations = new Counter({
  name: 'meow_cache_operations_total',
  help: 'Cache operations by cache name, layer, and outcome',
  labelNames: ['cache', 'layer', 'outcome'],
  registers,
});
export const questionDeliveryPayloadBytes = new Histogram({
  name: 'meow_question_delivery_payload_bytes',
  help: 'Serialized question delivery response payload size in bytes',
  labelNames: ['endpoint'],
  buckets: [1024, 4096, 16384, 32768, 65536, 131072, 262144, 524288, 1048576],
  registers,
});
export const questionDeliveryBatchSize = new Histogram({
  name: 'meow_question_delivery_batch_size',
  help: 'Number of questions delivered per batch by mode',
  labelNames: ['mode'],
  buckets: [1, 5, 10, 15, 20, 25, 30, 50, 100, 200],
  registers,
});
export const questionDeliveryDuplicatesPrevented = new Counter({
  name: 'meow_question_delivery_duplicates_prevented_total',
  help: 'Duplicate questions filtered or prevented during delivery',
  labelNames: ['surface'],
  registers,
});

const CACHE_LAYERS = new Set(['l1', 'redis', 'source']);
const CACHE_OUTCOMES = new Set(['hit', 'miss', 'stale', 'error', 'bypass']);
const MAX_TRACKED_CACHES = 64;
const cacheTallies = new Map();

function sanitizeLabel(value, fallback = 'other') {
  const cleaned = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '_')
    .slice(0, 48);
  return cleaned || fallback;
}

function emptyTally() {
  return {
    l1Hits: 0,
    l1Stale: 0,
    l1Misses: 0,
    redisHits: 0,
    redisStale: 0,
    redisMisses: 0,
    sourceMisses: 0,
    bypasses: 0,
    errors: 0,
  };
}

function summarizeTally(tally) {
  const cacheHits = tally.l1Hits + tally.l1Stale + tally.redisHits + tally.redisStale;
  const totalReads = cacheHits + tally.sourceMisses + tally.bypasses;
  const redisLookups = tally.redisHits + tally.redisStale + tally.redisMisses;
  return {
    ...tally,
    cacheHits,
    totalReads,
    hitRatio: totalReads > 0 ? cacheHits / totalReads : 0,
    redisLookups,
    redisHitRatio: redisLookups > 0 ? (tally.redisHits + tally.redisStale) / redisLookups : 0,
  };
}

export function observeCacheOperation({ cache = 'default', layer, outcome } = {}) {
  if (!CACHE_LAYERS.has(layer) || !CACHE_OUTCOMES.has(outcome)) return;
  let safeCache = sanitizeLabel(cache, 'default');
  if (!cacheTallies.has(safeCache)) {
    if (cacheTallies.size >= MAX_TRACKED_CACHES) safeCache = 'other';
    if (!cacheTallies.has(safeCache)) cacheTallies.set(safeCache, emptyTally());
  }
  cacheOperations.inc({ cache: safeCache, layer, outcome });
  const tally = cacheTallies.get(safeCache);
  if (outcome === 'error') tally.errors++;
  else if (outcome === 'bypass') tally.bypasses++;
  else if (layer === 'l1') {
    if (outcome === 'hit') tally.l1Hits++;
    else if (outcome === 'stale') tally.l1Stale++;
    else if (outcome === 'miss') tally.l1Misses++;
  } else if (layer === 'redis') {
    if (outcome === 'hit') tally.redisHits++;
    else if (outcome === 'stale') tally.redisStale++;
    else if (outcome === 'miss') tally.redisMisses++;
  } else if (layer === 'source' && outcome === 'miss') {
    tally.sourceMisses++;
  }
}

export function getCacheHitSummary(cacheName) {
  if (cacheName) {
    const safeCache = sanitizeLabel(cacheName, 'default');
    return summarizeTally(cacheTallies.get(safeCache) || emptyTally());
  }
  const combined = emptyTally();
  const byCache = {};
  for (const [name, tally] of cacheTallies.entries()) {
    byCache[name] = summarizeTally(tally);
    for (const key of Object.keys(combined)) combined[key] += tally[key];
  }
  return { ...summarizeTally(combined), byCache };
}

export function resetCacheHitSummary() {
  cacheTallies.clear();
}

const ALLOWED_DELIVERY_ENDPOINTS = new Set([
  '/api/v1/quiz/sessions',
  '/api/v1/quiz/sessions/:id',
  '/api/v1/quiz/sessions/:id/questions',
  '/api/v1/quiz/sessions/:id/answers',
  '/api/v1/quiz/sessions/:id/submit',
  '/api/v1/quiz/sessions/:id/result',
  '/api/questions',
  '/api/questions/session',
  '/api/questions/:id',
  '/api/questions/practice-test',
  '/api/questions/meta',
  '/api/questions/counts',
  '/api/questions/topic-counts',
  '/api/mocktest/:examSlug/:testId/start',
  '/api/mocktest/attempt/:attemptId',
  '/api/training/sessions',
  '/api/battle',
  'unknown',
  'other',
]);

const ALLOWED_DELIVERY_MODES = new Set([
  'practice',
  'topic',
  'speed',
  'mock',
  'ai',
  'battle',
  'concept',
  'formula',
  'mixed',
  'aichallenge',
  'easy',
  'hard',
  'studymode',
  'cursor',
  'legacy',
  'session',
  'unknown',
  'other',
]);

const ALLOWED_DELIVERY_SURFACES = new Set([
  'session-batch',
  'topic-pool',
  'speed-preload',
  'mock-paper',
  'ai-batch',
  'battle-set',
  'cursor-page',
  'legacy-page',
  'client-buffer',
  'practice',
  'topic',
  'speed',
  'mock',
  'ai',
  'battle',
  'unknown',
  'other',
]);

function sanitizeDeliveryEndpoint(value) {
  if (typeof value !== 'string') return 'unknown';
  const normalized = value.trim().toLowerCase().slice(0, 64);
  if (!normalized) return 'unknown';
  return ALLOWED_DELIVERY_ENDPOINTS.has(normalized) ? normalized : 'other';
}

function sanitizeAllowlistedLabel(value, allowlist, fallback = 'unknown') {
  if (value === undefined || value === null || String(value).trim() === '') return fallback;
  const cleaned = sanitizeLabel(value, fallback);
  return allowlist.has(cleaned) ? cleaned : 'other';
}

export function observeQuestionDelivery({
  endpoint,
  mode,
  payloadBytes,
  batchSize,
  duplicatesPrevented = 0,
  surface,
} = {}) {
  if (Number.isFinite(payloadBytes) && payloadBytes >= 0) {
    questionDeliveryPayloadBytes.observe({ endpoint: sanitizeDeliveryEndpoint(endpoint) }, payloadBytes);
  }
  if (Number.isFinite(batchSize) && batchSize >= 0) {
    questionDeliveryBatchSize.observe({ mode: sanitizeAllowlistedLabel(mode, ALLOWED_DELIVERY_MODES) }, batchSize);
  }
  if (Number.isFinite(duplicatesPrevented) && duplicatesPrevented > 0) {
    questionDeliveryDuplicatesPrevented.inc(
      { surface: sanitizeAllowlistedLabel(surface || mode || endpoint, ALLOWED_DELIVERY_SURFACES) },
      duplicatesPrevented,
    );
  }
}

export function recordHttp(req, res, durationMs) {
  if (['/health', '/api/health', '/live', '/metrics'].includes(req.path)) return;
  const route = req.route ? `${req.baseUrl || ''}${String(req.route.path)}` : 'unmatched';
  const method = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'].includes(req.method) ? req.method : 'OTHER';
  const operation = route === '/api/training/sessions/:id/actions' && ['answer', 'visit', 'finish', 'abandon'].includes(req.body?.type) ? req.body.type : 'request';
  httpLatency.observe({ method, route, operation }, durationMs / 1000);
  httpRequests.inc({ method, route, status: String(res.statusCode) });
}

export async function metricsHandler(req, res) {
  const token = process.env.METRICS_TOKEN;
  if (!token) return res.sendStatus(404);
  const supplied = Buffer.from(req.get('Authorization') || '');
  const expected = Buffer.from(`Bearer ${token}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return res.sendStatus(401);
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Metrics-Instance', metricsInstance);
  return res.type(registry.contentType).send(await registry.metrics());
}
