import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { startMaintenanceQueue, enqueueMaintenance, queueConnection } from '../maintenanceQueue.js';
import { createTieredCache } from '../tieredCache.js';
import { closeRedisClient } from '../../config/redis.js';

const enabled = Boolean(process.env.REDIS_TEST_URL);
let runtime, secondWorker;
let attempts = 0, successes = 0;
const run = async () => { attempts++; if (attempts === 1) throw new Error('Simulated worker failure'); successes++; return { ok: true }; };
beforeAll(async () => {
  if (!enabled) return;
  vi.stubEnv('REDIS_URL', process.env.REDIS_TEST_URL);
  vi.stubEnv('QUEUE_REDIS_URL', process.env.REDIS_TEST_URL);
  vi.stubEnv('REDIS_NAMESPACE', `reliability-test-${randomUUID()}`);
  vi.stubEnv('USE_DURABLE_QUEUE', 'true');
  vi.stubEnv('QUEUE_REDIS_ALLOW_SHARED', 'true');
  runtime = await startMaintenanceQueue([{ name: 'probe', run }]);
  secondWorker = new Worker('maintenance', run, { connection: { ...queueConnection(process.env.REDIS_TEST_URL), maxRetriesPerRequest: null }, prefix: runtime.queue.opts.prefix, concurrency: 2 });
  secondWorker.on('error', () => {});
});
afterAll(async () => {
  if (!enabled) return;
  await secondWorker?.close(); await runtime?.queue.obliterate({ force: true }); await runtime?.close();
  await closeRedisClient(); vi.unstubAllEnvs();
});

it.skipIf(!enabled)('deduplicates across workers and retries a failed job durably', async () => {
  const a = await enqueueMaintenance('probe', 'same-event');
  const b = await enqueueMaintenance('probe', 'same-event');
  expect(a.id).toBe(b.id);
  await vi.waitFor(async () => expect(await a.getState()).toBe('completed'), { timeout: 10000 });
  expect(successes).toBe(1); expect(attempts).toBe(2);
});

it.skipIf(!enabled)('coalesces simultaneous cold cache misses across instances with a real Redis lock', async () => {
  const a = createTieredCache(), b = createTieredCache();
  let builds = 0;
  const build = async () => { builds++; await new Promise(resolve => setTimeout(resolve, 100)); return { count: 7 }; };
  const results = await Promise.all([a.read('cold-shared', build), b.read('cold-shared', build)]);
  expect(results).toEqual([{ count: 7 }, { count: 7 }]); expect(builds).toBe(1);
});
