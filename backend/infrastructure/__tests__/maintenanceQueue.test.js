import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ scheduler: vi.fn(), concurrency: vi.fn(), close: vi.fn(), add: vi.fn(), ready: vi.fn(), worker: vi.fn() }));
vi.mock('bullmq', () => ({
  Queue: class { constructor() { this.upsertJobScheduler = mocks.scheduler; this.setGlobalConcurrency = mocks.concurrency; this.close = mocks.close; this.add = mocks.add; this.waitUntilReady = mocks.ready; } on() {} },
  Worker: class { constructor(name, run, options) { mocks.worker(name, run, options); } on() {} close() { return mocks.close(); } },
}));
import { enqueueMaintenance, maintenanceQueueHealth, queueConnection, startMaintenanceQueue } from '../maintenanceQueue.js';
beforeEach(() => { vi.clearAllMocks(); vi.stubEnv('USE_DURABLE_QUEUE', 'true'); vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:6379'); });

it('uses deduplicated schedules, global budgets, retry/backoff, tracing and draining', async () => {
  const run = vi.fn().mockResolvedValue('done');
  const queue = await startMaintenanceQueue([{ name: 'refresh', intervalMs: 5000, run }]);
  expect(mocks.concurrency).toHaveBeenCalledWith(2);
  expect(mocks.scheduler).toHaveBeenCalledWith('refresh', { every: 5000 }, expect.objectContaining({ opts: expect.objectContaining({ attempts: 5 }) }));
  const process = mocks.worker.mock.calls[0][1];
  expect(await process({ name: 'refresh', data: {}, attemptsMade: 0 })).toBe('done');
  await expect(process({ name: 'unknown', data: {} })).rejects.toThrow('Unknown');
  await enqueueMaintenance('refresh', 'same');
  await enqueueMaintenance('refresh', 'same');
  expect(mocks.add.mock.calls[0][2].jobId).toBe(mocks.add.mock.calls[1][2].jobId);
  await queue.close();
  expect(maintenanceQueueHealth()).toBe('disabled');
});

it('fails explicit queue activation safely when Redis cannot connect', async () => {
  mocks.ready.mockRejectedValueOnce(new Error('Redis down'));
  await expect(startMaintenanceQueue([])).rejects.toThrow('Redis down');
  expect(mocks.close).toHaveBeenCalled();
  expect(maintenanceQueueHealth()).toBe('degraded');
});

it('preserves TLS, ACL credentials and database settings', () => {
  expect(queueConnection('rediss://queue:secret@localhost:6380/2')).toMatchObject({ port: 6380, db: 2, tls: {}, username: 'queue', password: 'secret' });
  expect(() => queueConnection('https://localhost')).toThrow();
});
