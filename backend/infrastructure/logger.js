import pino from 'pino';
import { randomUUID } from 'node:crypto';
import { monitorEventLoopDelay, createHistogram } from 'node:perf_hooks';

const role = process.env.PROCESS_ROLE || (process.argv[1]?.endsWith('attachment-worker.js') ? 'attachments' : process.argv[1]?.endsWith('worker.js') ? 'maintenance' : 'api');
export const logger = pino({ level: process.env.LOG_LEVEL || 'info', base: { service: 'backend', role }, redact: ['password', 'token', 'authorization', 'cookie', 'secret', 'req.headers', 'req.body'] });
const databaseLatency = createHistogram();
let databaseErrors = 0;
export function observeMongo(event, failed = false) {
  if (event.commandName === 'getMore' && !failed) return; // Change streams intentionally wait for events.
  databaseLatency.record(Math.max(1, Math.round(event.duration * 1000)));
  if (failed) databaseErrors++;
  // Never record commands, filters, documents, or credentials.
  if (failed || event.duration > 500) logger.warn({ command: event.commandName, durationMs: event.duration, failed }, 'Mongo operation');
}
export function requestLogging(req, res, next) {
  const supplied = req.headers['x-request-id'];
  req.id = typeof supplied === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(supplied) ? supplied : randomUUID();
  res.setHeader('X-Request-ID', req.id);
  const start = performance.now();
  res.once('finish', () => logger.info({ requestId: req.id, method: req.method, route: req.route?.path || 'unmatched', status: res.statusCode, durationMs: Math.round(performance.now() - start) }, 'request completed'));
  next();
}
export function startRuntimeMetrics() {
  const histogram = monitorEventLoopDelay({ resolution: 20 });
  histogram.enable();
  const timer = setInterval(() => {
    logger.info({ eventLoopP99Ms: histogram.percentile(99) / 1e6, memory: process.memoryUsage(), mongo: { count: databaseLatency.count, p95Ms: databaseLatency.percentile(95) / 1000, errors: databaseErrors } }, 'runtime metrics');
    histogram.reset();
    databaseLatency.reset();
    databaseErrors = 0;
  }, 30000);
  timer.unref();
  return () => { clearInterval(timer); histogram.disable(); };
}
