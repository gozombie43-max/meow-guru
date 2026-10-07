import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ scheduler: vi.fn(), concurrency: vi.fn(), close: vi.fn(), add: vi.fn(), ready: vi.fn(), worker: vi.fn(), producer: vi.fn(), config: vi.fn(), info: vi.fn(), eval: vi.fn(async () => 1), zrem: vi.fn(), clientEvents: new Map() }));
vi.mock('bullmq', () => ({
  Queue: class { constructor(name, options) { mocks.producer(name, options); this.toKey = key => `${options.prefix}:${name}:${key}`; this.getBackend = () => ({ client: Promise.resolve({ status: 'ready', config: mocks.config, info: mocks.info, eval: mocks.eval, zrem: mocks.zrem, on: (event, listener) => mocks.clientEvents.set(event, listener) }) }); this.upsertJobScheduler = mocks.scheduler; this.setGlobalConcurrency = mocks.concurrency; this.close = mocks.close; this.add = mocks.add; this.waitUntilReady = mocks.ready; } on() {} },
  Worker: class { constructor(name, run, options) { mocks.worker(name, run, options); } on() {} close() { return mocks.close(); } },
  UnrecoverableError: class extends Error {},
}));
import { enqueueMaintenance, maintenanceQueueHealth, queueConnection, startMaintenanceQueue } from '../maintenanceQueue.js';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.clientEvents.clear();
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
  // Some maintenance callbacks take optional Date/generator arguments; retain
  // the no-argument contract rather than injecting job metadata into them.
  expect(run).toHaveBeenCalledWith();
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
  await expect(startMaintenanceQueue([{ name: 'refresh', intervalMs: 1000, run: vi.fn() }])).rejects.toThrow('noeviction');
  expect(mocks.scheduler).not.toHaveBeenCalled();
  expect(mocks.worker).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalled();
});

it('rejects disabled or unhealthy persistence before creating a worker', async () => {
  mocks.info.mockResolvedValue('loading:0\r\naof_enabled:0\r\naof_last_write_status:err\r\n');
  await expect(startMaintenanceQueue([])).rejects.toThrow('persistence');
  expect(mocks.worker).not.toHaveBeenCalled();
});

it('rejects shared-server logical databases without explicit consent and preserves independent queue namespaces', async () => {
  vi.stubEnv('QUEUE_REDIS_URL', 'rediss://other:acl@cache.example:6379/2');
  await expect(startMaintenanceQueue([])).rejects.toThrow('share a server');
  vi.stubEnv('QUEUE_REDIS_URL', 'rediss://other:acl@queue.example:6380/2');
  vi.stubEnv('QUEUE_REDIS_NAMESPACE', 'meow:test:durable');
  const runtime = await startMaintenanceQueue([]);
  expect(mocks.producer.mock.calls[0][1]).toMatchObject({ prefix: 'meow:test:durable:v1:jobs', connection: { tls: {}, commandTimeout: 2000, autoResendUnfulfilledCommands: false } });
  await runtime.close(); vi.unstubAllEnvs();
});

it('bounds admission, validates owners, coalesces duplicates and expires old ready jobs', async () => {
  const run = vi.fn(), runtime = await startMaintenanceQueue([{ name: 'refresh', run }]);
  try {
    await expect(enqueueMaintenance('unknown', 'key')).rejects.toMatchObject({ statusCode: 400 });
    await expect(enqueueMaintenance('refresh', 'key', { delay: 86400001 })).rejects.toMatchObject({ statusCode: 400 });
    mocks.eval.mockResolvedValueOnce(-1);
    await expect(enqueueMaintenance('refresh', 'full')).rejects.toMatchObject({ statusCode: 503, code: 'QUEUE_ADMISSION_REJECTED' });
    mocks.eval.mockResolvedValueOnce(-3);
    await expect(enqueueMaintenance('refresh', 'quota')).rejects.toMatchObject({ statusCode: 429 });
    mocks.add.mockClear(); mocks.eval.mockClear();
    await Promise.all(Array.from({ length: 100 }, () => enqueueMaintenance('refresh', 'same', { ownerId: 'learner' })));
    expect(mocks.add).toHaveBeenCalledTimes(1); expect(mocks.eval).toHaveBeenCalledTimes(1);
    const process = mocks.worker.mock.calls[0][1];
    await expect(process({ name: 'refresh', data: {}, timestamp: Date.now() - 1800001, opts: {}, attemptsMade: 0 })).rejects.toThrow('ready-age SLA');
    expect(run).not.toHaveBeenCalled();
  } finally { await runtime.close(); }
});

it('rejects enqueue and execution until reconnect durability is reverified, including runtime policy drift', async () => {
  vi.useFakeTimers();
  const run = vi.fn(), runtime = await startMaintenanceQueue([{ name: 'refresh', run }]);
  try {
    const process = mocks.worker.mock.calls[0][1];
    mocks.clientEvents.get('close')();
    expect(maintenanceQueueHealth()).toBe('degraded');
    await expect(enqueueMaintenance('refresh', 'offline')).rejects.toMatchObject({ statusCode: 503 });
    await expect(process({ name: 'refresh', data: {}, timestamp: Date.now(), attemptsMade: 0 })).rejects.toThrow('durability');
    mocks.clientEvents.get('ready')(); await vi.advanceTimersByTimeAsync(1);
    expect(runtime.isDurable()).toBe(true);
    mocks.config.mockImplementation(async (_command, key) => [key, key === 'maxmemory-policy' ? 'allkeys-lru' : 'yes']);
    await vi.advanceTimersByTimeAsync(30000);
    expect(runtime.isDurable()).toBe(false);
    await expect(enqueueMaintenance('refresh', 'unsafe-policy')).rejects.toMatchObject({ statusCode: 503 });
    expect(run).not.toHaveBeenCalled();
  } finally { await runtime.close(); vi.useRealTimers(); }
});
