import { Registry, Histogram, Counter, Gauge, collectDefaultMetrics } from '@prometheus-io/client';
import { timingSafeEqual } from 'node:crypto';

export const registry = new Registry();
const registers = [registry];
collectDefaultMetrics({ register: registry, prefix: 'meow_' });
export const httpLatency = new Histogram({ name: 'meow_http_duration_seconds', help: 'API request duration', labelNames: ['method', 'route', 'operation'], buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.35, 0.5, 0.8, 1, 2, 5, 10], registers });
export const httpRequests = new Counter({ name: 'meow_http_requests_total', help: 'Completed API requests', labelNames: ['method', 'route', 'status'], registers });
export const dependencyLatency = new Histogram({ name: 'meow_dependency_duration_seconds', help: 'Dependency operation duration', labelNames: ['dependency', 'operation'], buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.3, 0.5, 1, 5, 10], registers });
export const dependencyErrors = new Counter({ name: 'meow_dependency_errors_total', help: 'Dependency failures', labelNames: ['dependency'], registers });
export const mongoPoolWaiting = new Gauge({ name: 'meow_mongo_pool_waiting', help: 'Pending Mongo connection checkouts', registers });

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
  return res.type(registry.contentType).send(await registry.metrics());
}
