import pino from 'pino';
import { randomUUID, createHash } from 'node:crypto';
import { monitorEventLoopDelay, createHistogram } from 'node:perf_hooks';
import { traceFields } from './tracing.js';
import { recordHttp, dependencyLatency, dependencyErrors } from './metrics.js';
import { mongoRequestContext } from './mongoOperationMetrics.js';

export function hashId(id) {
  return id ? createHash('sha256').update(String(id)).digest('hex').substring(0, 16) : undefined;
}

const role = process.env.PROCESS_ROLE || (process.argv[1]?.endsWith('attachment-worker.js') ? 'attachments' : process.argv[1]?.endsWith('worker.js') ? 'worker' : 'api');
export const logger = pino({ level: process.env.LOG_LEVEL || 'info', mixin: traceFields, base: { service: 'backend', role }, redact: ['password', 'token', 'authorization', 'cookie', 'secret', 'req.headers', 'req.body'] });
const databaseLatency = createHistogram();
let databaseErrors = 0;
let runtimeHealth = { eventLoopP99Ms: 0 };
export function getRuntimeHealth() { return { ...runtimeHealth, rssBytes: process.memoryUsage().rss }; }
export function observeMongo(event, failed = false) {
  if (event.commandName === 'getMore' && !failed) return; // Change streams intentionally wait for events.
  databaseLatency.record(Math.max(1, Math.round(event.duration * 1000)));
  dependencyLatency.observe({ dependency: 'mongo', operation: event.commandName || 'unknown' }, event.duration / 1000);
  if (failed) dependencyErrors.inc({ dependency: 'mongo' });
  if (failed) databaseErrors++;
  // Never record commands, filters, documents, or credentials.
  if (failed || event.duration > 500) logger.warn({ command: event.commandName, durationMs: event.duration, failed }, 'Mongo operation');
}
export function requestLogging(req, res, next) {
  const supplied = req.headers['x-request-id'];
  req.id ||= typeof supplied === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(supplied) ? supplied : randomUUID();
  res.setHeader('X-Request-ID', req.id);
  const start = performance.now();
  const correlation = traceFields();
  const mongo = { total: 0, operations: {} };
  res.once('finish', () => {
    const durationMs = Math.round(performance.now() - start);
    recordHttp(req, res, durationMs);
    logger.info({ ...correlation, requestId: req.id, userHash: hashId(req.user?.id), method: req.method, route: req.route?.path || 'unmatched', status: res.statusCode, durationMs, mongo }, 'request completed');
  });
  mongoRequestContext.run(mongo, next);
}
export function startRuntimeMetrics() {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  const timer = setInterval(() => {
    runtimeHealth = { eventLoopP99Ms: histogram.percentile(99) / 1e6 };
    logger.info({ eventLoopP99Ms: histogram.percentile(99) / 1e6, memory: process.memoryUsage(), mongo: { count: databaseLatency.count, p95Ms: databaseLatency.percentile(95) / 1000, errors: databaseErrors } }, 'runtime metrics');
    histogram.reset();
    databaseLatency.reset();
    databaseErrors = 0;
  }, 30000);
  timer.unref();
  return () => { clearInterval(timer); histogram.disable(); };
}
