import { BSON } from 'mongodb';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('redis', () => ({ createClient: mock.createClient }));
let api, raw;
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); vi.stubEnv('REDIS_URL', 'redis://isolated-mock'); vi.stubEnv('REDIS_NAMESPACE', 'meow:test:unit');
  raw = { isReady: true, isOpen: true, on: vi.fn(), connect: vi.fn(async () => {}), ping: vi.fn(async () => 'PONG'),
    get: vi.fn(async () => null), mGet: vi.fn(async () => []), set: vi.fn(async () => 'OK'), eval: vi.fn(async () => 1),
    destroy: vi.fn(() => { raw.isOpen = false; }) };
  mock.createClient.mockReturnValue(raw);
  api = await import('../redis.js');
});
afterEach(async () => { await api.closeRedisClient(); vi.useRealTimers(); vi.unstubAllEnvs(); });

it('skips command requests after repeated timeouts and permits only one recovery ping', async () => {
  raw.get.mockRejectedValue(Object.assign(new Error('command timeout'), { name: 'TimeoutError' }));
  for (let i = 0; i < 5; i++) expect(await api.redisGetJson('key')).toBeNull();
  expect(api.redisCircuitHealth()).toBe('open');
  for (let i = 0; i < 20; i++) expect(await api.redisGetJson('key')).toBeNull();
  expect(raw.get).toHaveBeenCalledTimes(5);
  await vi.advanceTimersByTimeAsync(15001);
  let release;
  raw.ping.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  const probe = api.getRedisClient();
  expect(await api.getRedisClient()).toBeNull();
  release('PONG'); await probe;
  expect(api.redisCircuitHealth()).toBe('closed'); expect(raw.ping).toHaveBeenCalledTimes(1);
  raw.get.mockResolvedValue('{"count":7}');
  expect(await api.redisGetJson('key')).toEqual({ count: 7 });
});

it('backs off connection failures without issuing a new connect on each cache operation', async () => {
  raw.connect.mockRejectedValue(new Error('offline'));
  expect(await api.getRedisClient()).toBeNull();
  for (let i = 0; i < 20; i++) await api.getRedisClient();
  expect(raw.connect).toHaveBeenCalledTimes(1);
  expect(api.redisHealth()).toBe('degraded');
});

it('bounds a stalled connection handshake and releases all coalesced callers', async () => {
  raw.connect.mockImplementation(() => new Promise(() => {}));
  const callers = [api.getRedisClient(), api.getRedisClient(), api.getRedisClient()];
  await vi.advanceTimersByTimeAsync(1000);
  expect(await Promise.all(callers)).toEqual([null, null, null]);
  expect(raw.destroy).toHaveBeenCalled();
  expect(api.redisHealth()).toBe('degraded');
  expect(await api.getRedisClient()).toBeNull();
  expect(raw.connect).toHaveBeenCalledTimes(1);
});

it('keeps the shared socket alive on a single transient timeout and destroys/opens after consecutive timeouts breach the threshold', async () => {
  raw.get.mockImplementation(() => new Promise(() => {}));
  // First two transient timeouts fall back individually without destroying the shared socket.
  const first = api.redisGetJson('stalled-1');
  await vi.advanceTimersByTimeAsync(1000);
  expect(await first).toBeNull();
  expect(raw.destroy).not.toHaveBeenCalled();
  expect(api.redisCircuitHealth()).toBe('closed');

  const second = api.redisGetJson('stalled-2');
  await vi.advanceTimersByTimeAsync(1000);
  expect(await second).toBeNull();
  expect(raw.destroy).not.toHaveBeenCalled();
  expect(api.redisCircuitHealth()).toBe('closed');

  // Third consecutive timeout breaches the threshold -> destroys stalled socket & opens circuit.
  const third = api.redisGetJson('stalled-3');
  await vi.advanceTimersByTimeAsync(1000);
  expect(await third).toBeNull();
  expect(raw.destroy).toHaveBeenCalled();
  expect(api.redisCircuitHealth()).toBe('open');
  expect(await api.getRedisClient()).toBeNull();
});

it('backs off provider quota errors immediately for five minutes', async () => {
  raw.get.mockRejectedValue(new Error('ERR max requests limit exceeded. Limit: 500000, Usage: 500002.'));
  expect(await api.redisGetJson('quota')).toBeNull();
  expect(api.redisHealth()).toBe('degraded');
  expect(api.redisCircuitHealth()).toBe('open');
  for (let i = 0; i < 20; i++) expect(await api.getRedisClient()).toBeNull();
  await vi.advanceTimersByTimeAsync(15001);
  expect(await api.getRedisClient()).toBeNull();
  expect(raw.ping).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(300000);
  expect(await api.getRedisClient()).not.toBeNull();
  expect(raw.ping).toHaveBeenCalledOnce();
});

it('retains the provider quota backoff when connection setup is rejected', async () => {
  raw.connect.mockRejectedValue(new Error('ERR max requests limit exceeded.'));
  expect(await api.getRedisClient()).toBeNull();
  await vi.advanceTimersByTimeAsync(15001);
  expect(await api.getRedisClient()).toBeNull();
  expect(raw.connect).toHaveBeenCalledOnce();
});

it('keeps the access-code HTTP route available when the shared limiter waits forever for Redis', async () => {
  vi.useRealTimers();
  raw.eval.mockImplementation(() => new Promise(() => {}));
  const { default: express } = await import('express');
  const { default: rateLimit } = await import('express-rate-limit');
  const { RedisRateLimitStore } = await import('../../middleware/redisRateLimitStore.js');
  const { default: accessCodeRoutes } = await import('../../routes/accessCodes.js');
  const app = express();
  app.use(express.json());
  const limit = prefix => rateLimit({ store: new RedisRateLimitStore(prefix), windowMs: 9000, limit: 100 });
  app.use(limit('global'));
  app.use('/api/access-code', limit('auth'), accessCodeRoutes);
  const server = await new Promise(resolve => { const started = app.listen(0, '127.0.0.1', () => resolve(started)); });
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/access-code/check`, { signal: AbortSignal.timeout(4000) });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ valid: false });
    expect(raw.eval).toHaveBeenCalledTimes(2);
    const verification = await fetch(`http://127.0.0.1:${server.address().port}/api/access-code/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), signal: AbortSignal.timeout(3000),
    });
    expect(verification.status).toBe(400);
    await verification.json();
    // Third consecutive timeout trips the isolated rate-limit circuit; the auth limiter on the same request bypasses Redis immediately,
    // while the shared cache circuit stays closed and unaffected.
    expect(raw.eval).toHaveBeenCalledTimes(3);
    expect(api.rateLimitRedisCircuitHealth()).toBe('open');
    expect(api.redisCircuitHealth()).toBe('closed');
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
});

it('raises commandsQueueMaxLength to 2048 by default, isolates the rate-limit client, and reports non-blocking cache stats', async () => {
  const rateRaw = {
    isReady: true, isOpen: true, on: vi.fn(), connect: vi.fn(async () => {}), ping: vi.fn(async () => 'PONG'),
    eval: vi.fn(async () => [1, 8000, Date.now() + 8000]), info: vi.fn(async () => 'used_memory:1024\r\nmaxmemory_policy:allkeys-lru\r\nkeyspace_hits:90\r\nkeyspace_misses:10'),
    destroy: vi.fn(() => { rateRaw.isOpen = false; }),
  };
  mock.createClient.mockReturnValueOnce(raw).mockReturnValueOnce(rateRaw);
  const cacheClient = await api.getRedisClient();
  const rateClient = await api.getRateLimitRedisClient();
  expect(cacheClient).not.toBeNull();
  expect(rateClient).not.toBeNull();
  expect(mock.createClient).toHaveBeenCalledTimes(2);
  expect(mock.createClient.mock.calls[0][0].commandsQueueMaxLength).toBe(2048);
  expect(mock.createClient.mock.calls[1][0].commandsQueueMaxLength).toBe(2048);

  // Tripping the rate-limit circuit must NOT open or degrade the cache-read client.
  rateRaw.eval.mockRejectedValue(new Error('rate-limit burst failure'));
  for (let i = 0; i < 5; i++) {
    await expect(rateClient.eval('return 1', { keys: ['k'], arguments: [] })).rejects.toThrow();
  }
  expect(api.rateLimitRedisCircuitHealth()).toBe('open');
  expect(api.redisCircuitHealth()).toBe('closed');
  expect(api.redisHealth()).toBe('healthy');

  const stats = api.getRedisCacheStats();
  expect(stats).toMatchObject({
    configured: true,
    commandsQueueMaxLength: 2048,
    recommendedEvictionPolicy: 'allkeys-lru',
    cache: { health: 'healthy', circuit: 'closed' },
    rateLimit: { health: 'degraded', circuit: 'open' },
  });
});

it('bounds JSON values and skips oversized reads and writes without breaking callers', async () => {
  expect(await api.redisSetJson('large', { value: 'x'.repeat(600000) }, 10)).toBe(false);
  expect(raw.set).not.toHaveBeenCalled();
  raw.get.mockResolvedValue(' '.repeat(600000));
  expect(await api.redisGetJson('large')).toBeNull();
  const circular = {}; circular.self = circular;
  expect(await api.redisSetJson('circular', circular, 10)).toBe(false);
  expect(api.redisCircuitHealth()).toBe('closed');
  expect(await api.redisSetJson('small', { count: 7 }, 10)).toBe(true);
  expect(raw.set).toHaveBeenCalledWith('meow:test:unit:v1:small', '{"count":7}', { EX: 10 });
});

it('preserves BSON ObjectIds with EJSON and applies the fenced write atomically', async () => {
  const value = { id: new BSON.ObjectId() };
  await api.redisSetEjson('pool', value, 10);
  raw.get.mockResolvedValue(raw.set.mock.calls[0][1]);
  expect((await api.redisGetEjson('pool')).id).toBeInstanceOf(BSON.ObjectId);
  const lease = { lockKey: 'lock', fenceKey: 'fence', owner: 'owner', fence: 2 };
  await api.redisSetJson('key', { count: 8 }, 5, { lease });
  expect(raw.eval.mock.calls[0][1]).toEqual({ keys: ['lock', 'fence', 'meow:test:unit:v1:key'], arguments: ['owner', '2', '{"count":8}', '5'] });
});

it('keeps explicit namespace identity stable across equivalent Mongo URI forms', () => {
  vi.stubEnv('MONGODB_URI', 'mongodb://host/a'); const key = api.redisKey('scope');
  vi.stubEnv('MONGODB_URI', 'mongodb://host/a?retryWrites=true');
  expect(api.redisKey('scope')).toBe(key);
});

it('falls back to defaults (not min bounds) when numeric Redis env vars are empty or whitespace', async () => {
  vi.stubEnv('REDIS_COMMANDS_QUEUE_MAX', '');
  vi.stubEnv('REDIS_COMMAND_TIMEOUT_MS', '   ');
  vi.stubEnv('REDIS_CONSECUTIVE_TIMEOUT_THRESHOLD', '');

  await api.getRedisClient();
  expect(mock.createClient).toHaveBeenCalledWith(expect.objectContaining({
    commandsQueueMaxLength: 2048,
    commandOptions: { timeout: 1000 },
  }));
  expect(api.getRedisCacheStats()).toMatchObject({
    commandsQueueMaxLength: 2048,
    commandTimeoutMs: 1000,
    consecutiveTimeoutThreshold: 3,
  });
});
