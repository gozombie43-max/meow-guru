import { LRUCache } from 'lru-cache';
import { randomUUID, createHash } from 'node:crypto';
import { getRedisClient, redisGetJson, redisSetJson, redisKey } from '../config/redis.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const unlock = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
const renew = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('PEXPIRE', KEYS[1], ARGV[2]) end return 0";
const caches = new Set();
export function clearSharedLocalCaches() { for (const ref of caches) { const cache = ref.deref(); if (cache) cache.clear(); else caches.delete(ref); } }
export function registerSharedLocalCache(cache) { caches.add(new WeakRef(cache)); }

export function createTieredCache({ freshMs = 300000, staleMs = 1800000, localMs = 10000, lockMs = 15000, waitMs = 5000, now = Date.now, random = Math.random, getShared = redisGetJson, setShared = redisSetJson } = {}) {
  const local = new LRUCache({ max: 300, maxSize: 20 * 1024 * 1024, sizeCalculation: value => Buffer.byteLength(JSON.stringify(value)), ttl: staleMs });
  const pending = new Map();
  const api = { clear() { local.clear(); }, read };
  caches.add(new WeakRef(api));

  async function refresh(key, build) {
    const scoped = redisKey(key);
    if (pending.has(scoped)) return pending.get(scoped);
    if (pending.size >= 256) throw Object.assign(new Error('Metadata refresh capacity exceeded'), { statusCode: 503 });
    const work = (async () => {
      let redis;
      try { redis = await getRedisClient(); } catch { /* optional shared cache */ }
      const token = randomUUID(), lockKey = redisKey(`cache-lock:${createHash('sha256').update(key).digest('hex')}`);
      let acquired = false, renewal;
      try {
        if (redis) {
          const deadline = now() + waitMs;
          do {
            try { acquired = Boolean(await redis.set(lockKey, token, { NX: true, PX: lockMs })); }
            catch { redis = null; break; }
            const shared = await getShared(key);
            if (shared?.freshUntil > now()) { local.set(scoped, { ...shared, checkedAt: now() }); return shared.value; }
            if (acquired) break;
            if (now() >= deadline) throw Object.assign(new Error('Metadata refresh is busy'), { statusCode: 503 });
            await pause(50 + Math.floor(random() * 100));
          } while (true);
          if (acquired) {
            renewal = setInterval(() => { void redis.eval(renew, { keys: [lockKey], arguments: [token, String(lockMs)] }).catch(() => {}); }, Math.floor(lockMs / 3));
            renewal.unref();
          }
        }
        const value = await build();
        const freshUntil = now() + Math.min(staleMs, Math.round(freshMs * (0.9 + random() * 0.2)));
        const entry = { value, freshUntil, staleUntil: now() + staleMs };
        await setShared(key, entry, Math.max(1, Math.ceil(staleMs / 1000)));
        local.set(scoped, { ...entry, checkedAt: now() });
        return value;
      } finally {
        clearInterval(renewal);
        if (acquired) await redis.eval(unlock, { keys: [lockKey], arguments: [token] }).catch(() => {});
      }
    })();
    pending.set(scoped, work);
    try { return await work; }
    finally { pending.delete(scoped); }
  }

  async function read(key, build, { allowStale = true } = {}) {
    const scoped = redisKey(key);
    let entry = local.get(scoped);
    if (!entry || now() - entry.checkedAt >= localMs) {
      const shared = await getShared(key);
      if (shared?.staleUntil > now()) entry = { ...shared, checkedAt: now() };
      if (entry) local.set(scoped, entry);
    }
    if (entry?.freshUntil > now()) return entry.value;
    if (allowStale && entry?.staleUntil > now()) {
      void refresh(key, build).catch(() => {});
      return entry.value;
    }
    return refresh(key, build);
  }
  return api;
}
