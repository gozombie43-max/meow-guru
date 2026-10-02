import { createHash } from 'node:crypto';
import { redisKey } from '../config/redis.js';
import { logger } from './logger.js';
import { withTrace, withTraceCarrier, traceCarrier } from './tracing.js';

let active;
let state = 'disabled';
export function maintenanceQueueHealth() { return state; }

export function queueConnection(url) {
  const parsed = new URL(url);
  if (!['redis:', 'rediss:'].includes(parsed.protocol)) throw new Error('Queue requires a Redis URL');
  return {
    host: parsed.hostname, port: Number(parsed.port) || 6379,
    username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
    password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
    db: Number(parsed.pathname.slice(1)) || 0,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    connectTimeout: 2000, enableOfflineQueue: false,
  };
}

export async function startMaintenanceQueue(tasks, options = {}) {
  if (active) return active;
  if (process.env.USE_DURABLE_QUEUE !== 'true') return null;
  if (!process.env.REDIS_URL) throw new Error('USE_DURABLE_QUEUE requires REDIS_URL');
  state = 'starting';
  const { Queue, Worker } = await import('bullmq');
  const connection = queueConnection(process.env.REDIS_URL);
  const prefix = redisKey('jobs');
  let connected = false;
  const queue = new Queue('maintenance', {
    // Initial activation fails promptly; an established producer reconnects
    // with jitter while individual requests still fail without offline buffering.
    connection: { ...connection, maxRetriesPerRequest: 1, retryStrategy: attempt => connected ? Math.round(Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)) * (0.8 + Math.random() * 0.4)) : null }, prefix,
    defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 1000, jitter: 0.3 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 7 * 86400, count: 5000 } },
  });
  queue.on('error', () => { state = 'degraded'; });
  let worker;
  try {
    await queue.waitUntilReady();
    connected = true;
    await queue.setGlobalConcurrency(options.concurrency || 2);
    for (const task of tasks) {
      if (!task.intervalMs) continue;
      await queue.upsertJobScheduler(task.name, { every: task.intervalMs }, {
        name: task.name, data: {}, opts: { attempts: 5, backoff: { type: 'exponential', delay: 1000, jitter: 0.3 } },
      });
    }
    const handlers = new Map(tasks.map(task => [task.name, task.run]));
    worker = new Worker('maintenance', async job => {
      const run = handlers.get(job.name);
      if (!run) throw new Error('Unknown maintenance task');
      return withTraceCarrier(job.data.trace, () => withTrace('job.maintenance', { 'job.type': job.name, 'job.attempt': job.attemptsMade + 1 }, run));
    }, { connection: { ...connection, enableOfflineQueue: true, maxRetriesPerRequest: null }, prefix, concurrency: options.concurrency || 2, lockDuration: 240000, maxStalledCount: 2 });
    worker.on('error', () => { state = 'degraded'; });
    worker.on('completed', () => { state = 'healthy'; });
    worker.on('failed', (job) => logger.warn({ jobType: job?.name, attempts: job?.attemptsMade }, 'maintenance job failed; retained for retry or dead-letter review'));
    state = 'healthy';
    active = {
      queue,
      async close() { state = 'draining'; await worker.close(); await queue.close(); active = null; state = 'disabled'; },
    };
    return active;
  } catch (error) {
    if (worker) await worker.close(true).catch(() => {});
    await queue.close().catch(() => {});
    state = 'degraded';
    throw error;
  }
}

export async function enqueueMaintenance(name, deduplicationKey, { delay = 0, priority = 10 } = {}) {
  if (!active) throw new Error('Maintenance queue is not active');
  const jobId = createHash('sha256').update(`${name}:${deduplicationKey}`).digest('hex');
  return active.queue.add(name, { trace: traceCarrier() }, { jobId, delay, priority });
}
