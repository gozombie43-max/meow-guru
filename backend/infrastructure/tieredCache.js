import { LRUCache } from 'lru-cache';
import { randomUUID, createHash } from 'node:crypto';
import { getRedisClient, redisGetJson, redisSetJson, redisKey } from '../config/redis.js';
import { acquireLease, renewLease, releaseLease } from './cacheLease.js';
import { encodeCacheValue, JSON_CACHE_MAX_BYTES } from './cacheEncoding.js';
import { createSingleFlight } from './singleFlight.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const emptyValue = value => value == null || (Array.isArray(value) && !value.length) ||
  (Array.isArray(value?.questions) && !value.questions.length) || value?.total === 0;
const caches = new Set();
export function clearSharedLocalCaches() { for (const ref of caches) { const cache = ref.deref(); if (cache) cache.clear(); else caches.delete(ref); } }
export function registerSharedLocalCache(cache) { caches.add(new WeakRef(cache)); }

export function createTieredCache({ freshMs = 300000, staleMs = 1800000, localMs = 10000, lockMs = 15000, waitMs = 250, negativeMs = 5000, isEmpty = emptyValue, validUntil = () => Infinity, maxEntryBytes = JSON_CACHE_MAX_BYTES, localCache, now = Date.now, random = Math.random, getShared = redisGetJson, setShared = redisSetJson } = {}) {
  const local = localCache || new LRUCache({ max: 300, maxSize: 20 * 1024 * 1024, maxEntrySize: maxEntryBytes, sizeCalculation: entry => entry.cacheBytes });
  const pending = new Map(), reads = createSingleFlight();
  let generation = 0;
  const api = {
    clear() { generation++; local.clear(); pending.clear(); }, read,
    prime(key, entry) { remember(redisKey(sharedKey(key)), entry); },
    hasFresh(key) { return local.get(redisKey(sharedKey(key)))?.freshUntil > now(); },
  };
  caches.add(new WeakRef(api));
  const sharedKey = key => `tiered:v2:${key}`;
  function remember(scoped, entry, expectedGeneration = generation, encoded) {
    if (generation !== expectedGeneration || !(entry?.staleUntil > now())) return;
    encoded ||= encodeCacheValue(entry, 'json', maxEntryBytes);
    if (encoded) local.set(scoped, { ...entry, cacheBytes: encoded.bytes, checkedAt: now() }, { ttl: entry.staleUntil - now() });
  }

  async function refresh(key, build) {
    const scoped = redisKey(sharedKey(key)), currentGeneration = generation;
    if (pending.has(scoped)) return pending.get(scoped);
    if (pending.size >= 256) throw Object.assign(new Error('Metadata refresh capacity exceeded'), { statusCode: 503 });
    const work = (async () => {
      let redis;
      try { redis = await getRedisClient(); } catch { /* optional shared cache */ }
      const digest = createHash('sha256').update(sharedKey(key)).digest('hex');
      const lease = { owner: randomUUID(), lockKey: redisKey(`cache-lock:v2:${digest}`), fenceKey: redisKey(`cache-fence:v2:${digest}`), fence: 0 };
      const retentionMs = staleMs + lockMs * 2;
      let acquired = false, renewal;
      try {
        if (redis) {
          const deadline = now() + waitMs;
          do {
            try {
              lease.fence = Number(await redis.eval(acquireLease, { keys: [lease.lockKey, lease.fenceKey], arguments: [lease.owner, String(lockMs), String(retentionMs)] }));
              acquired = lease.fence > 0;
            } catch { redis = null; break; }
            const shared = await getShared(sharedKey(key));
            if (shared?.freshUntil > now()) { remember(scoped, shared, currentGeneration); return shared.value; }
            if (acquired || now() >= deadline) break;
            await pause(Math.min(50 + Math.floor(random() * 50), Math.max(1, deadline - now())));
          } while (true);
          if (acquired) {
            renewal = setInterval(() => {
              void redis.eval(renewLease, { keys: [lease.lockKey, lease.fenceKey], arguments: [lease.owner, String(lockMs), String(retentionMs)] }).catch(() => {});
            }, Math.max(1, Math.floor(lockMs / 3)));
            renewal.unref();
          }
        }
        const value = await build();
        if (generation !== currentGeneration) return value;
        const negative = isEmpty(value);
        const lifetime = negative ? Math.min(negativeMs, staleMs) : staleMs;
        const deadline = validUntil(value);
        const freshUntil = Math.min(deadline, now() + (negative ? lifetime : Math.min(lifetime, Math.round(freshMs * (0.9 + random() * 0.2)))));
        const entry = { value, freshUntil, staleUntil: Math.min(deadline, now() + lifetime), ...(acquired ? { fence: lease.fence } : {}) };
        // A waiter can read Mongo after the bounded wait, but must not publish
        // over the lease owner's result. Only an atomic fenced write may do so.
        if (redis && !acquired) return value;
        if (entry.staleUntil <= now()) return value;
        const encoded = encodeCacheValue(entry, 'json', maxEntryBytes);
        if (!encoded) return value;
        // A failed acquisition can mean the server accepted a lease whose reply
        // was lost. Redis may recover during the build; never publish unfenced.
        if (!acquired) { remember(scoped, entry, currentGeneration, encoded); return value; }
        const stored = await setShared(sharedKey(key), entry, Math.max(1, Math.ceil((entry.staleUntil - now()) / 1000)), acquired ? { lease } : {});
        if (acquired && stored === false) {
          const winner = await getShared(sharedKey(key));
          if (winner?.freshUntil > now()) { remember(scoped, winner, currentGeneration); return winner.value; }
          return value;
        }
        remember(scoped, entry, currentGeneration, encoded);
        return value;
      } finally {
        clearInterval(renewal);
        if (acquired) await redis.eval(releaseLease, { keys: [lease.lockKey], arguments: [lease.owner] }).catch(() => {});
      }
    })();
    pending.set(scoped, work);
    try { return await work; }
    finally { if (pending.get(scoped) === work) pending.delete(scoped); }
  }

  async function read(key, build, { allowStale = true, sharedChecked = false } = {}) {
    const scoped = redisKey(sharedKey(key));
    return reads(`${scoped}:${generation}`, async () => {
      const currentGeneration = generation;
      let entry = local.get(scoped);
      if (!entry || now() - entry.checkedAt >= localMs) {
        const shared = sharedChecked ? null : await getShared(sharedKey(key));
        if (shared?.staleUntil > now()) { entry = shared; remember(scoped, entry, currentGeneration); }
      }
      if (entry?.freshUntil > now()) return entry.value;
      if (allowStale && entry?.staleUntil > now()) {
        void refresh(key, build).catch(() => {});
        return entry.value;
      }
      return refresh(key, build);
    });
  }
  return api;
}
