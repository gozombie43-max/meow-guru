import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ scheduler: vi.fn(), concurrency: vi.fn(), close: vi.fn(), add: vi.fn(), ready: vi.fn(), worker: vi.fn(), producer: vi.fn(), config: vi.fn(), info: vi.fn() }));
vi.mock('bullmq', () => ({
  Queue: class { constructor(name, options) { mocks.producer(name, options); this.client = Promise.resolve({ config: mocks.config, info: mocks.info }); this.upsertJobScheduler = mocks.scheduler; this.setGlobalConcurrency = mocks.concurrency; this.close = mocks.close; this.add = mocks.add; this.waitUntilReady = mocks.ready; } on() {} },
  Worker: class { constructor(name, run, options) { mocks.worker(name, run, options); } on() {} close() { return mocks.close(); } },
}));
import { enqueueMaintenance, maintenanceQueueHealth, queueConnection, startMaintenanceQueue } from '../maintenanceQueue.js';
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('USE_DURABLE_QUEUE', 'true');
  vi.stubEnv('REDIS_URL', 'redis://cache.example:6379');
  vi.stubEnv('QUEUE_REDIS_URL', 'redis://127.0.0.1:6380');
  vi.stubEnv('QUEUE_REDIS_ALLOW_SHARED', 'false');
  mocks.config.mockImplementation(async (_command, key) => [key, { 'maxmemory-policy': 'noeviction', appendonly: 'yes', save: '' }[key]]);
  mocks.info.mockResolvedValue('loading:0\r\naof_enabled:1\r\naof_last_write_status:ok\r\n');
});

it('uses deduplicated schedules, global budgets, retry/backoff, tracing and draining', async () => {
  const run = vi.fn().mockResolvedValue('done');
  const queue = await startMaintenanceQueue([{ name: 'refresh', intervalMs: 5000, run }]);
  expect(mocks.concurrency).toHaveBeenCalledWith(2);
  expect(mocks.producer.mock.calls[0][1].connection).toMatchObject({ host: '127.0.0.1', port: 6380 });
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

it('requires deliberate cache-Redis sharing and verifies it before scheduling', async () => {
  vi.stubEnv('QUEUE_REDIS_URL', '');
  await expect(startMaintenanceQueue([])).rejects.toThrow('QUEUE_REDIS_URL');
  expect(mocks.producer).not.toHaveBeenCalled();
  vi.stubEnv('QUEUE_REDIS_ALLOW_SHARED', 'true');
  const runtime = await startMaintenanceQueue([]);
  expect(mocks.producer.mock.calls[0][1].connection.host).toBe('cache.example');
  await runtime.close();
});

it.each(['allkeys-lru', 'volatile-lru'])('rejects %s before writing schedules or creating workers', async policy => {
  mocks.config.mockImplementation(async (_command, key) => [key, key === 'maxmemory-policy' ? policy : 'yes']);
  await expect(startMaintenanceQueue([{ name: 'refresh', intervalMs: 1000 }])).rejects.toThrow('noeviction');
  expect(mocks.scheduler).not.toHaveBeenCalled();
  expect(mocks.worker).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalled();
});

it('rejects disabled or unhealthy persistence before creating a worker', async () => {
  mocks.info.mockResolvedValue('loading:0\r\naof_enabled:0\r\naof_last_write_status:err\r\n');
  await expect(startMaintenanceQueue([])).rejects.toThrow('persistence');
  expect(mocks.worker).not.toHaveBeenCalled();
});
