import { randomUUID, createHash } from 'node:crypto';
import { createClient } from 'redis';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { closeRedisClient, redisKey } from '../../config/redis.js';
import { RedisRateLimitStore } from '../../middleware/redisRateLimitStore.js';
import { cacheInvalidationHealth, closeCacheInvalidationSubscriber, onCacheInvalidation, startCacheInvalidationSubscriber } from '../cacheInvalidation.js';
import { createTieredCache } from '../tieredCache.js';
import { acquireLease, writeWithLease } from '../cacheLease.js';

const enabled = Boolean(process.env.REDIS_TEST_URL);
describe.skipIf(!enabled)('Redis correctness on an isolated server', () => {
  let probe, removeListener;
  beforeAll(async () => {
    vi.stubEnv('REDIS_URL', process.env.REDIS_TEST_URL);
    vi.stubEnv('REDIS_NAMESPACE', `correctness-test-${randomUUID()}`);
    probe = createClient({ url: process.env.REDIS_TEST_URL });
    probe.on('error', () => {});
    await probe.connect();
  });
  afterAll(async () => {
    removeListener?.(); await closeCacheInvalidationSubscriber(); await closeRedisClient();
    probe?.destroy(); vi.unstubAllEnvs(); vi.restoreAllMocks();
  });

  it.each([false, true])('rejects a delayed builder after its lease is lost (fence reset=%s)', async resetFence => {
    const key = `fencing:${randomUUID()}`;
    const digest = createHash('sha256').update(`tiered:v2:${key}`).digest('hex');
    const lock = redisKey(`cache-lock:v2:${digest}`), fence = redisKey(`cache-fence:v2:${digest}`);
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    const first = createTieredCache(), second = createTieredCache();
    const delayed = first.read(key, async () => { entered(); await gate; return { count: 1 }; }, { allowStale: false });
    await started;
    expect(await probe.get(lock)).toEqual(expect.any(String));
    // Remove only this test's lease, modeling expiry or restored fence metadata.
    await probe.del(resetFence ? [lock, fence] : [lock]);
    try {
      expect(await second.read(key, async () => ({ count: 2 }), { allowStale: false })).toEqual({ count: 2 });
    } finally { release(); }
    expect(await delayed).toEqual({ count: 2 });
    expect(await createTieredCache().read(key, () => { throw new Error('Unexpected rebuild'); })).toEqual({ count: 2 });
    expect(await probe.pTTL(fence)).toBeGreaterThan(0);
    expect(await probe.pTTL(fence)).toBeLessThanOrEqual(1830000);
    expect(await probe.exists(lock)).toBe(0);
  });

  it('rejects an expired lease owner after a new owner publishes', async () => {
    const prefix = redisKey(`expiry-fence:${randomUUID()}`), lock = `${prefix}:lock`, fence = `${prefix}:fence`, value = `${prefix}:value`;
    const oldOwner = randomUUID(), newOwner = randomUUID();
    const oldFence = await probe.eval(acquireLease, { keys: [lock, fence], arguments: [oldOwner, '40', '60000'] });
    await new Promise(resolve => setTimeout(resolve, 70));
    const newFence = await probe.eval(acquireLease, { keys: [lock, fence], arguments: [newOwner, '5000', '60000'] });
    expect(newFence).toBeGreaterThan(oldFence);
    expect(await probe.eval(writeWithLease, { keys: [lock, fence, value], arguments: [newOwner, String(newFence), 'new', '60'] })).toBe(1);
    expect(await probe.eval(writeWithLease, { keys: [lock, fence, value], arguments: [oldOwner, String(oldFence), 'old', '60'] })).toBe(0);
    expect(await probe.get(value)).toBe('new'); await probe.del([lock, fence, value]);
  });

  it('coalesces waiters and returns source data when a healthy Redis lock is busy', async () => {
    const key = `busy:${randomUUID()}`, digest = createHash('sha256').update(`tiered:v2:${key}`).digest('hex');
    const lock = redisKey(`cache-lock:v2:${digest}`);
    await probe.set(lock, 'another-builder', { PX: 5000 });
    const cache = createTieredCache({ waitMs: 25 }), build = vi.fn(async () => ({ count: 7 }));
    expect(await Promise.all(Array.from({ length: 100 }, () => cache.read(key, build, { allowStale: false })))).toEqual(Array(100).fill({ count: 7 }));
    expect(build).toHaveBeenCalledTimes(1);
    expect(await probe.get(redisKey(`tiered:v2:${key}`))).toBeNull();
    expect(await probe.get(lock)).toBe('another-builder');
    await probe.del(lock);
  });

  it('does not extend a shared absolute deadline when warming a local cache', async () => {
    const key = `expiry:${randomUUID()}`, deadline = Date.now() + 100;
    await probe.set(redisKey(`tiered:v2:${key}`), JSON.stringify({ value: 1, freshUntil: deadline, staleUntil: deadline }), { EX: 10 });
    const cache = createTieredCache(), build = vi.fn(async () => 2);
    expect(await cache.read(key, build, { allowStale: false })).toBe(1);
    await new Promise(resolve => setTimeout(resolve, Math.max(0, deadline - Date.now()) + 20));
    expect(await cache.read(key, build, { allowStale: false })).toBe(2);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('shares fixed windows across instances and discards previous local hits on rollover', async () => {
    const first = new RedisRateLimitStore('rollover'), second = new RedisRateLimitStore('rollover');
    first.init({ windowMs: 400 }); second.init({ windowMs: 400 });
    const a = await first.increment('learner');
    const b = await second.increment('learner');
    if (b.resetTime.getTime() === a.resetTime.getTime()) expect(b.totalHits).toBe(a.totalHits + 1);
    expect(b.resetTime.getTime() % 400).toBe(0);
    // Deliberately leave a larger previous-window local count than Redis.
    first.fallback.observe('learner', { totalHits: 100, resetTime: b.resetTime });
    const now = Date.now();
    await new Promise(resolve => setTimeout(resolve, Math.max(0, b.resetTime.getTime() - now) + 20));
    const current = await first.increment('learner');
    expect(current.totalHits).toBe(1);
    expect(current.resetTime.getTime()).toBeGreaterThan(b.resetTime.getTime());
    expect(await probe.pTTL(first.key('learner'))).toBeGreaterThan(0);
    await first.resetKey('learner');
  });

  it('restores subscriptions after a real TCP disconnect and exposes received-event health', async () => {
    const received = vi.fn(); removeListener = onCacheInvalidation(received);
    await startCacheInvalidationSubscriber();
    const publish = () => probe.publish(redisKey('cache-events'), JSON.stringify({ version: 1, type: 'topic-progress.changed' }));
    await publish();
    await vi.waitFor(() => expect(received).toHaveBeenCalledWith('topic-progress.changed'));
    received.mockClear();
    const clients = await probe.sendCommand(['CLIENT', 'LIST', 'TYPE', 'PUBSUB']);
    const target = clients.split('\n').find(line => line.includes(`name=${redisKey('cache-invalidation-subscriber')} `));
    expect(target).toBeTruthy();
    const id = target.match(/(?:^| )id=(\d+)/)[1];
    // Kill only our uniquely namespaced subscriber, leaving other clients alone.
    await probe.sendCommand(['CLIENT', 'KILL', 'ID', id]);
    await vi.waitFor(() => expect(cacheInvalidationHealth().reconnectCount).toBeGreaterThan(0), { timeout: 5000 });
    await vi.waitFor(() => expect(cacheInvalidationHealth().state).toBe('subscribed'), { timeout: 5000 });
    await publish();
    await vi.waitFor(() => expect(received).toHaveBeenCalledWith('topic-progress.changed'));
    expect(cacheInvalidationHealth().lastInvalidationReceivedAt).toEqual(expect.any(String));
  });
});
