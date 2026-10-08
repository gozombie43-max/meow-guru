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
export const authBurstLatency = new Histogram({ name: 'meow_auth_validation_burst_duration_seconds', help: 'Actual coalesced authorization work, including Mongo and Redis', labelNames: ['cache', 'outcome'], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10], registers });
export const redisCacheOversized = new Counter({ name: 'meow_redis_cache_oversized_total', help: 'Cache values bypassed for exceeding byte or traversal budgets', labelNames: ['format'], registers });
export const redisCacheValueBytes = new Histogram({ name: 'meow_redis_cache_value_bytes', help: 'Serialized cache value bytes', labelNames: ['format'], buckets: [1024, 16384, 65536, 262144, 524288, 1048576, 2097152], registers });
export const redisCircuitState = new Gauge({ name: 'meow_redis_circuit_state', help: 'Optional Redis circuit: 0 closed, 1 open, 2 half-open', registers });
export const redisCommandTimeouts = new Counter({ name: 'meow_redis_command_timeout_total', help: 'Redis connection or command timeouts', registers });
export const redisFallbacks = new Counter({ name: 'meow_redis_fallback_total', help: 'Redis bypasses during unavailable connections or open circuit', registers });
export const trainingCreateStageDuration = new Histogram({ name: 'meow_training_create_stage_duration_seconds', help: 'Training creation stage duration, including failed stages', labelNames: ['stage', 'outcome'], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1, 2, 5, 10], registers });

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
