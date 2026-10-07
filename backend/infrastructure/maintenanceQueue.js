import { createHash } from 'node:crypto';
import { redisKey } from '../config/redis.js';
import { logger } from './logger.js';
import { withTrace, withTraceCarrier, traceCarrier } from './tracing.js';
import { maintenanceQueuePolicy, sameRedisServer } from '../config/maintenanceQueuePolicy.js';
import { admitMaintenance } from './queueAdmission.js';
import { createSingleFlight } from './singleFlight.js';

let active;
let state = 'disabled';
let starting;
const enqueues = createSingleFlight();
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

export async function verifyQueueDurability(client) {
  // Different logical databases share the same eviction and persistence policy.
  const [eviction, aof, snapshots, persistence] = await Promise.all([
    client.config('GET', 'maxmemory-policy'),
    client.config('GET', 'appendonly'),
    client.config('GET', 'save'),
    client.info('persistence'),
  ]);
  if (eviction[1] !== 'noeviction') throw new Error('Durable queue Redis requires maxmemory-policy=noeviction');
  const fields = Object.fromEntries(persistence.split(/\r?\n/).filter(line => line.includes(':')).map(line => line.split(':')));
  const hasAof = aof[1] === 'yes' && fields.aof_enabled === '1' && fields.aof_last_write_status === 'ok';
  const hasSnapshots = Boolean(snapshots[1]?.trim()) && fields.rdb_last_bgsave_status === 'ok';
  if (fields.loading !== '0' || (!hasAof && !hasSnapshots)) throw new Error('Durable queue Redis requires healthy enabled persistence');
}

export async function startMaintenanceQueue(tasks, options = {}) {
  if (active) return active;
  if (starting) return starting;
  if (process.env.USE_DURABLE_QUEUE !== 'true') return null;
  starting = activateQueue(tasks, options);
  try { return await starting; } finally { starting = undefined; }
}
async function activateQueue(tasks, options) {
  const policy = maintenanceQueuePolicy();
  if (tasks.length > 16 || new Set(tasks.map(task => task.name)).size !== tasks.length || tasks.some(task => !/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(task.name) || typeof task.run !== 'function' || (task.intervalMs !== undefined && (!Number.isSafeInteger(task.intervalMs) || task.intervalMs < 1000)))) throw new Error('Invalid maintenance task registry');
  const url = process.env.QUEUE_REDIS_URL || (process.env.QUEUE_REDIS_ALLOW_SHARED === 'true' ? process.env.REDIS_URL : undefined);
  if (!url) throw new Error('USE_DURABLE_QUEUE requires QUEUE_REDIS_URL (or explicit QUEUE_REDIS_ALLOW_SHARED=true)');
  if (sameRedisServer(url, process.env.REDIS_URL) && process.env.QUEUE_REDIS_ALLOW_SHARED !== 'true') throw new Error('Queue and cache Redis share a server; require a separate server or QUEUE_REDIS_ALLOW_SHARED=true');
  state = 'starting';
  const { Queue, Worker, UnrecoverableError } = await import('bullmq');
  const connection = queueConnection(url);
  const prefix = process.env.QUEUE_REDIS_NAMESPACE ? `${process.env.QUEUE_REDIS_NAMESPACE}:v1:jobs` : redisKey('jobs');
  let connected = false;
  const queue = new Queue('maintenance', {
    // Initial activation fails promptly; an established producer reconnects
    // with jitter while individual requests still fail without offline buffering.
    connection: { ...connection, commandTimeout: 2000, autoResendUnfulfilledCommands: false, maxRetriesPerRequest: 1, retryStrategy: attempt => connected ? Math.round(Math.min(30000, 1000 * 2 ** Math.min(attempt, 5)) * (0.8 + Math.random() * 0.4)) : null }, prefix,
    defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 1000, jitter: 0.3 }, removeOnComplete: { age: 86400, count: 1000 }, removeOnFail: { age: 7 * 86400, count: 5000 } },
  });
  queue.on('error', () => { state = 'degraded'; });
  let worker, durabilityTimer, producer;
  let durable = false, workerHealthy = true, needsReconcile = false;
  const configure = async () => {
    await queue.setGlobalConcurrency(options.concurrency || 2);
    for (const task of tasks) {
      if (!task.intervalMs) continue;
      await queue.upsertJobScheduler(task.name, { every: task.intervalMs }, {
        name: task.name, data: {}, opts: { attempts: 5, backoff: { type: 'exponential', delay: 1000, jitter: 0.3 } },
      });
    }
  };
  try {
    await queue.waitUntilReady();
    producer = await queue.getBackend().client;
    await verifyQueueDurability(producer); durable = true;
    connected = true;
    await configure();
    const handlers = new Map(tasks.map(task => [task.name, task.run]));
    worker = new Worker('maintenance', async job => {
      if (!durable || producer.status !== 'ready') throw new Error('Maintenance Redis durability is not verified');
      const run = handlers.get(job.name);
      if (!run) throw new Error('Unknown maintenance task');
      const eligibleAt = Number(job.timestamp) + (Number(job.opts?.delay) || 0);
      if (Number.isFinite(eligibleAt) && Date.now() - eligibleAt > policy.QUEUE_MAX_READY_AGE_MS) throw new UnrecoverableError('Maintenance job exceeded its ready-age SLA');
      return withTraceCarrier(job.data.trace, () => withTrace('job.maintenance', { 'job.type': job.name, 'job.attempt': job.attemptsMade + 1 }, () => run()));
    }, { connection: { ...connection, enableOfflineQueue: true, maxRetriesPerRequest: null }, prefix, concurrency: options.concurrency || 2, lockDuration: 240000, maxStalledCount: 2 });
    worker.on('error', () => { workerHealthy = false; state = 'degraded'; });
    worker.on('ready', () => { workerHealthy = true; if (durable && producer.status === 'ready') state = 'healthy'; });
    worker.on('completed', () => { workerHealthy = true; if (durable && producer.status === 'ready') state = 'healthy'; });
    worker.on('failed', (job) => logger.warn({ jobType: job?.name, attempts: job?.attemptsMade }, 'maintenance job failed; retained for retry or dead-letter review'));
    state = 'healthy';
    const verify = async () => {
      if (producer.status !== 'ready') { durable = false; state = 'degraded'; return; }
      try {
        await verifyQueueDurability(producer);
        // A restored snapshot may have lost queue metadata and schedulers.
        // Reapply our bounded registry before admitting work after reconnect.
        if (needsReconcile) { await configure(); needsReconcile = false; }
        durable = true; if (active?.queue === queue) state = workerHealthy ? 'healthy' : 'degraded';
      }
      catch { durable = false; state = 'degraded'; }
    };
    producer.on?.('close', () => { durable = false; needsReconcile = true; if (active?.queue === queue) state = 'degraded'; });
    producer.on?.('ready', () => void verify());
    durabilityTimer = setInterval(() => void verify(), 30000); durabilityTimer.unref();
    active = {
      queue, producer, handlers, policy, isDurable: () => durable,
      async close() { state = 'draining'; clearInterval(durabilityTimer); durable = false; await worker.close(); await queue.close(); active = null; state = 'disabled'; },
    };
    return active;
  } catch (error) {
    clearInterval(durabilityTimer);
    if (worker) {
      try { await worker.close(true); } catch {}
    }
    try { await queue.close(); } catch {}
    state = 'degraded';
    throw error;
  }
}

export async function enqueueMaintenance(name, deduplicationKey, { delay = 0, priority = 10, ownerId = 'system' } = {}) {
  if (!active) throw new Error('Maintenance queue is not active');
  if (!active.handlers.has(name) || typeof deduplicationKey !== 'string' || !deduplicationKey || deduplicationKey.length > 512 || typeof ownerId !== 'string' || !ownerId || ownerId.length > 200 || !Number.isSafeInteger(delay) || delay < 0 || delay > 86400000 || !Number.isSafeInteger(priority) || priority < 0 || priority > 2097152) throw Object.assign(new Error('Invalid maintenance enqueue'), { statusCode: 400 });
  const jobId = createHash('sha256').update(JSON.stringify([name, deduplicationKey, ownerId])).digest('hex');
  const runtime = active;
  return enqueues(jobId, async () => {
    if (!runtime.isDurable() || runtime.producer.status !== 'ready' || runtime !== active) throw Object.assign(new Error('Maintenance queue unavailable'), { statusCode: 503 });
    const release = await admitMaintenance(runtime.queue, runtime.producer, jobId, ownerId, delay, runtime.policy);
    try { return await runtime.queue.add(name, { trace: traceCarrier() }, { jobId, delay, priority, deduplication: { id: jobId, ttl: runtime.policy.QUEUE_DEDUPE_WINDOW_MS } }); }
    finally { await release().catch(() => { state = 'degraded'; }); }
  });
}
