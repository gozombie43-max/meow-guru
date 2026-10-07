import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ createClient: vi.fn(), clear: vi.fn(), getRedisClient: vi.fn() }));
vi.mock('redis', () => ({ createClient: mocks.createClient }));
vi.mock('../../config/redis.js', () => ({ getRedisClient: mocks.getRedisClient, redisKey: key => key, reportRedisFailure: vi.fn() }));
vi.mock('../tieredCache.js', () => ({ clearSharedLocalCaches: mocks.clear }));
let api, client, receive;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks(); vi.useFakeTimers();
  vi.stubEnv('REDIS_URL', 'redis://isolated-mock');
  client = Object.assign(new EventEmitter(), {
    isOpen: false,
    connect: vi.fn(async () => { client.isOpen = true; client.emit('ready'); }),
    subscribe: vi.fn(async (_key, callback) => { receive = callback; }),
    destroy: vi.fn(() => { client.isOpen = false; client.emit('end'); }),
  });
  mocks.createClient.mockReturnValue(client);
  api = await import('../cacheInvalidation.js');
});
afterEach(async () => { await api.closeCacheInvalidationSubscriber(); vi.useRealTimers(); vi.unstubAllEnvs(); });

it('uses a dedicated reconnecting client and resubscribes after terminal disconnect', async () => {
  await Promise.all([api.startCacheInvalidationSubscriber(), api.startCacheInvalidationSubscriber()]);
  expect(mocks.createClient).toHaveBeenCalledTimes(1);
  expect(mocks.createClient.mock.calls[0][0].socket.reconnectStrategy(20)).toBeGreaterThan(0);
  expect(api.cacheInvalidationHealth().state).toBe('subscribed');
  client.emit('error', new Error('connection lost'));
  client.emit('reconnecting'); client.emit('ready');
  expect(api.cacheInvalidationHealth()).toMatchObject({ state: 'subscribed', reconnectCount: 1 });
  client.destroy();
  await vi.advanceTimersByTimeAsync(4000);
  expect(mocks.createClient).toHaveBeenCalledTimes(2);
  expect(client.subscribe).toHaveBeenCalledTimes(2);
});

it('automatically retries a failed startup and records received invalidations', async () => {
  client.connect.mockRejectedValueOnce(new Error('Redis offline'));
  await api.startCacheInvalidationSubscriber();
  expect(client.destroy).toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(4000);
  expect(api.cacheInvalidationHealth().state).toBe('subscribed');
  const listener = vi.fn(); api.onCacheInvalidation(listener);
  receive('{bad'); receive(JSON.stringify({ version: 1, type: 'question.changed' }));
  expect(listener).toHaveBeenCalledWith('question.changed');
  expect(api.cacheInvalidationHealth().lastInvalidationReceivedAt).toEqual(expect.any(String));
});

it('bounds startup waits and cancels retries during shutdown', async () => {
  client.connect.mockImplementationOnce(() => new Promise(() => {}));
  const starting = api.startCacheInvalidationSubscriber();
  await vi.advanceTimersByTimeAsync(3001);
  await starting;
  await api.closeCacheInvalidationSubscriber();
  await vi.advanceTimersByTimeAsync(20000);
  expect(mocks.createClient).toHaveBeenCalledTimes(1);
});
