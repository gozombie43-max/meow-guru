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

it('falls back after a command that never receives a reply and opens the circuit', async () => {
  raw.get.mockImplementation(() => new Promise(() => {}));
  const read = api.redisGetJson('stalled');
  await vi.advanceTimersByTimeAsync(1000);
  expect(await read).toBeNull();
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
    expect(raw.eval).toHaveBeenCalledTimes(1);
    expect(api.redisCircuitHealth()).toBe('open');
    const verification = await fetch(`http://127.0.0.1:${server.address().port}/api/access-code/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}), signal: AbortSignal.timeout(2000),
    });
    expect(verification.status).toBe(400);
    await verification.json();
  } finally {
    await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); });
  }
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
