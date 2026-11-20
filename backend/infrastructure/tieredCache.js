import { LRUCache } from 'lru-cache';
import { randomUUID, createHash } from 'node:crypto';
import { getRedisClient, redisGetJson, redisSetJson, redisKey } from '../config/redis.js';
import { acquireLease, renewLease, releaseLease } from './cacheLease.js';
import { encodeCacheValue, JSON_CACHE_MAX_BYTES } from './cacheEncoding.js';
import { createSingleFlight } from './singleFlight.js';
import { observeCacheOperation } from './metrics.js';

const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const emptyValue = value => value == null || (Array.isArray(value) && !value.length) ||
  (Array.isArray(value?.questions) && !value.questions.length) || value?.total === 0;
const caches = new Set();
export function clearSharedLocalCaches() { for (const ref of caches) { const cache = ref.deref(); if (cache) cache.clear(); else caches.delete(ref); } }
export function evictSharedLocalCaches(predicate) {
  if (typeof predicate !== 'function') { clearSharedLocalCaches(); return 0; }
  let removed = 0;
  for (const ref of caches) {
    const cache = ref.deref();
    if (!cache) { caches.delete(ref); continue; }
    if (typeof cache.deleteWhere === 'function') removed += cache.deleteWhere(predicate);
  }
  return removed;
}
export function registerSharedLocalCache(cache) { caches.add(new WeakRef(cache)); }

const isEnvelope = candidate => Boolean(
  candidate && typeof candidate === 'object' && Object.hasOwn(candidate, 'value')
    && typeof candidate.freshUntil === 'number' && typeof candidate.staleUntil === 'number',
);

export function createTieredCache({
  name = 'tiered',
  freshMs = 300000,
  staleMs = 1800000,
  localMs = 10000,
  lockMs = 15000,
  waitMs = 250,
  negativeMs = 5000,
  jitterRatio = 0.15,
  strictMaxTtl,
  isEmpty = emptyValue,
  validUntil = () => Infinity,
  maxEntryBytes = JSON_CACHE_MAX_BYTES,
  format = 'json',
  distributedLock = true,
  localCache,
  now = () => Date.now(),
  random = Math.random,
  getShared = redisGetJson,
  setShared = redisSetJson,
} = {}) {
  const local = localCache || new LRUCache({ max: 300, maxSize: 20 * 1024 * 1024, maxEntrySize: maxEntryBytes, sizeCalculation: entry => entry.cacheBytes });
  const pending = new Map(), reads = createSingleFlight();
  let generation = 0;
  const sharedKey = key => `tiered:v2:${key}`;
  const clampedJitter = Number.isFinite(jitterRatio) ? Math.max(0, Math.min(0.5, jitterRatio)) : 0.15;
  // Exact-TTL caches (freshMs === staleMs) default to bounded downward jitter [1 - jitter, 1.0]
  // so expirations spread uniformly without clumping AND never exceed the caller's max TTL ceiling.
  // SWR caches (staleMs > freshMs) use symmetric +/-jitter [1 - jitter, 1 + jitter] unless strictMaxTtl=true.
  const effectiveStrictMaxTtl = typeof strictMaxTtl === 'boolean' ? strictMaxTtl : freshMs === staleMs;

  function createEntry(value, key, extra = {}) {
    const timestamp = now();
    const negative = isEmpty(value, key);
    const deadline = validUntil(value);
    if (negative) {
      const lifetime = Math.min(negativeMs, staleMs);
      const expires = Math.min(deadline, timestamp + lifetime);
      return { value, freshUntil: expires, staleUntil: expires, ...extra };
    }
    // Apply uniform jitter to both freshUntil and staleUntil (and therefore Redis EX)
    // so expirations never clump at 50% when freshMs === staleMs.
    // At random() === 0.5 with effectiveStrictMaxTtl=false, factor is 1.0 for deterministic tests.
    const factor = clampedJitter > 0
      ? (effectiveStrictMaxTtl
        ? (1 - clampedJitter) + random() * clampedJitter
        : (1 - clampedJitter) + random() * (clampedJitter * 2))
      : 1;
    const jitteredStale = Math.max(1, Math.round(staleMs * factor));
    const jitteredFresh = Math.min(jitteredStale, Math.max(1, Math.round(freshMs * factor)));
    const freshUntil = Math.min(deadline, timestamp + jitteredFresh);
    const staleUntil = Math.min(deadline, timestamp + jitteredStale);
    return { value, freshUntil, staleUntil, ...extra };
  }
  function remember(scoped, entry, expectedGeneration = generation, encoded, logicalKey) {
    const timestamp = now();
    if (generation !== expectedGeneration || !(entry?.staleUntil > timestamp)) return null;
    encoded ||= encodeCacheValue(entry, format, maxEntryBytes);
    if (!encoded) return null;
    const existing = local.get(scoped);
    const stored = {
      ...entry,
      ...(existing?.refreshNotBefore > timestamp && !(entry.freshUntil > timestamp)
        ? { refreshNotBefore: existing.refreshNotBefore }
        : {}),
      cacheBytes: encoded.bytes,
      checkedAt: timestamp,
      logicalKey: logicalKey ?? existing?.logicalKey ?? scoped,
    };
    local.set(scoped, stored, { ttl: entry.staleUntil - timestamp });
    return stored;
  }
  const api = {
    name,
    clear() { generation++; local.clear(); pending.clear(); },
    delete(key) {
      const scoped = redisKey(sharedKey(key));
      pending.delete(scoped);
      return local.delete(scoped);
    },
    deleteWhere(predicate) {
      if (typeof predicate !== 'function') return 0;
      const toDelete = [];
      for (const [scopedKey, entry] of local.entries()) {
        if (predicate(entry?.logicalKey ?? scopedKey, scopedKey)) toDelete.push(scopedKey);
      }
      for (const scopedKey of toDelete) {
        local.delete(scopedKey);
        pending.delete(scopedKey);
      }
      return toDelete.length;
    },
    read,
    prime(key, entryOrValue) {
      const entry = isEnvelope(entryOrValue) ? entryOrValue : createEntry(entryOrValue, key);
      remember(redisKey(sharedKey(key)), entry, generation, undefined, key);
    },
    hasFresh(key) { return local.get(redisKey(sharedKey(key)))?.freshUntil > now(); },
    peekFresh(key) {
      const entry = local.get(redisKey(sharedKey(key)));
      if (entry?.freshUntil > now()) {
        observeCacheOperation({ cache: name, layer: 'l1', outcome: 'hit' });
        return { hit: true, value: entry.value };
      }
      return { hit: false, value: undefined };
    },
  };
  caches.add(new WeakRef(api));

  async function runSourceBuild(build) {
    try {
      const value = await build();
      observeCacheOperation({ cache: name, layer: 'source', outcome: 'miss' });
      return value;
    } catch (error) {
      observeCacheOperation({ cache: name, layer: 'source', outcome: 'error' });
      throw error;
    }
  }

  async function refresh(key, build, { cacheShared = true, skipInitialSharedCheck = false, background = false } = {}) {
    const scoped = redisKey(sharedKey(key)), currentGeneration = generation;
    if (pending.has(scoped)) return pending.get(scoped);
    if (pending.size >= 256) throw Object.assign(new Error('Metadata refresh capacity exceeded'), { statusCode: 503 });
    const work = (async () => {
      if (!cacheShared || !distributedLock) {
        if (cacheShared && !skipInitialSharedCheck) {
          const shared = await getShared(sharedKey(key));
          if (shared?.freshUntil > now()) {
            remember(scoped, shared, currentGeneration, undefined, key);
            if (!background) observeCacheOperation({ cache: name, layer: 'redis', outcome: 'hit' });
            return shared.value;
          }
        }
        const value = await runSourceBuild(build);
        if (generation !== currentGeneration) return value;
        const entry = createEntry(value, key);
        if (entry.staleUntil <= now()) return value;
        const encoded = encodeCacheValue(entry, format, maxEntryBytes);
        if (!encoded) return value;
        if (cacheShared) {
          await setShared(sharedKey(key), entry, Math.max(1, Math.ceil((entry.staleUntil - now()) / 1000)), { encoded });
        }
        remember(scoped, entry, currentGeneration, encoded, key);
        return value;
      }

      let redis;
      try { redis = await getRedisClient(); } catch { /* optional shared cache */ }
      const digest = createHash('sha256').update(sharedKey(key)).digest('hex');
      const lease = { owner: randomUUID(), lockKey: redisKey(`cache-lock:v2:${digest}`), fenceKey: redisKey(`cache-fence:v2:${digest}`), fence: 0 };
      const retentionMs = staleMs + lockMs * 2;
      let acquired = false, released = false, renewal;
      try {
        if (redis) {
          const deadline = now() + waitMs;
          let firstAttempt = true;
          do {
            try {
              lease.fence = Number(await redis.eval(acquireLease, { keys: [lease.lockKey, lease.fenceKey], arguments: [lease.owner, String(lockMs), String(retentionMs)] }));
              acquired = lease.fence > 0;
            } catch { redis = null; break; }
            if (!(firstAttempt && skipInitialSharedCheck && (acquired || now() < deadline))) {
              const shared = await getShared(sharedKey(key));
              if (shared?.freshUntil > now()) {
                remember(scoped, shared, currentGeneration, undefined, key);
                if (!background) observeCacheOperation({ cache: name, layer: 'redis', outcome: 'hit' });
                return shared.value;
              }
            }
            firstAttempt = false;
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
        const value = await runSourceBuild(build);
        if (generation !== currentGeneration) return value;
        const entry = createEntry(value, key, acquired ? { fence: lease.fence } : {});
        // A waiter can read Mongo after the bounded wait, but must not publish
        // over the lease owner's result. Only an atomic fenced write may do so.
        if (redis && !acquired) return value;
        if (entry.staleUntil <= now()) return value;
        const encoded = encodeCacheValue(entry, format, maxEntryBytes);
        if (!encoded) return value;
        // A failed acquisition can mean the server accepted a lease whose reply
        // was lost. Redis may recover during the build; never publish unfenced.
        if (!acquired) { remember(scoped, entry, currentGeneration, encoded, key); return value; }
        const stored = await setShared(sharedKey(key), entry, Math.max(1, Math.ceil((entry.staleUntil - now()) / 1000)), { lease, encoded });
        if (stored === true) released = true;
        if (stored === false) {
          const winner = await getShared(sharedKey(key));
          if (winner?.freshUntil > now()) { remember(scoped, winner, currentGeneration, undefined, key); return winner.value; }
          return value;
        }
        remember(scoped, entry, currentGeneration, encoded, key);
        return value;
      } finally {
        clearInterval(renewal);
        if (acquired && !released) await redis.eval(releaseLease, { keys: [lease.lockKey], arguments: [lease.owner] }).catch(() => {});
      }
    })();
    pending.set(scoped, work);
    try { return await work; }
    finally { if (generation === currentGeneration) pending.delete(scoped); }
  }

  async function read(key, build, { allowStale = true, sharedChecked = false, cacheShared = true } = {}) {
    const scoped = redisKey(sharedKey(key));
    return reads(`${scoped}:${generation}`, async () => {
      const currentGeneration = generation;
      let entry = local.get(scoped);
      if (entry?.freshUntil > now()) {
        observeCacheOperation({ cache: name, layer: 'l1', outcome: 'hit' });
        return entry.value;
      }
      let checkedShared = sharedChecked;
      let loadedFromShared = false;
      if (cacheShared && !checkedShared && (!entry || now() - entry.checkedAt >= localMs)) {
        checkedShared = true;
        const shared = await getShared(sharedKey(key));
        if (shared?.staleUntil > now()) {
          loadedFromShared = true;
          entry = remember(scoped, shared, currentGeneration, undefined, key) || shared;
        } else {
          observeCacheOperation({ cache: name, layer: 'redis', outcome: 'miss' });
          if (entry) entry.checkedAt = now();
        }
      }
      if (entry?.freshUntil > now()) {
        observeCacheOperation({ cache: name, layer: loadedFromShared ? 'redis' : 'l1', outcome: 'hit' });
        return entry.value;
      }
      if (allowStale && entry?.staleUntil > now()) {
        observeCacheOperation({ cache: name, layer: loadedFromShared ? 'redis' : 'l1', outcome: 'stale' });
        if (!entry.refreshNotBefore || now() >= entry.refreshNotBefore) {
          entry.refreshNotBefore = now() + localMs;
          void refresh(key, build, { cacheShared, skipInitialSharedCheck: checkedShared, background: true }).catch(() => {});
        }
        return entry.value;
      }
      return refresh(key, build, { cacheShared, skipInitialSharedCheck: checkedShared });
    });
  }
  return api;
}
