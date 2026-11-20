import { randomUUID } from 'node:crypto';
import { LRUCache } from 'lru-cache';
import { getCacheCounter, advanceCacheCounter } from '../repositories/cacheRevisionRepository.js';
import { getRedisClient, redisGetJson, redisSetJson } from '../config/redis.js';
import { JSON_CACHE_MAX_BYTES } from './cacheEncoding.js';
import { createTieredCache, registerSharedLocalCache } from './tieredCache.js';
import { createSingleFlight } from './singleFlight.js';
import { observeCacheOperation } from './metrics.js';

const DEFAULT_REVISION_CACHE_MS = 5_000;

function resolveRevisionCacheMs(explicit) {
  if (Number.isFinite(explicit)) return Math.max(0, Math.floor(explicit));
  const raw = process.env.PROGRESS_REVISION_CACHE_MS;
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    return DEFAULT_REVISION_CACHE_MS;
  }
  const envVal = Number(raw);
  if (Number.isFinite(envVal) && envVal >= 0) return Math.min(30_000, Math.floor(envVal));
  return DEFAULT_REVISION_CACHE_MS;
}

export function createDurableProgressCache(
  prefix,
  owner,
  ttlSeconds,
  { validUntil = () => Infinity, maxEntries = 2000, revisionCacheMs } = {},
) {
  const scope = (...args) => `${prefix}:v2:${owner(...args)}`;
  const bumpMarkerKey = revisionScope => `progress-bump:v2:${revisionScope}`;
  const cache = createTieredCache({
    name: prefix,
    freshMs: ttlSeconds * 1000,
    staleMs: ttlSeconds * 1000,
    strictMaxTtl: true,
    waitMs: 100,
    distributedLock: false,
    isEmpty: () => false,
    validUntil,
    localCache: new LRUCache({
      max: maxEntries,
      maxSize: 20 * 1024 * 1024,
      maxEntrySize: JSON_CACHE_MAX_BYTES,
      sizeCalculation: entry => entry.cacheBytes,
    }),
  });
  const revisionCache = new LRUCache({ max: maxEntries });
  let nextEpoch = 1;
  let globalClearEpoch = 0;
  const scopeEpochs = new Map();
  const maxScopeEpochs = Math.max(maxEntries * 2, 4000);
  const currentEpoch = revisionScope => Math.max(globalClearEpoch, scopeEpochs.get(revisionScope) ?? 0);
  const bumpScopeEpoch = revisionScope => {
    const epoch = nextEpoch++;
    if (scopeEpochs.size >= maxScopeEpochs && !scopeEpochs.has(revisionScope)) {
      globalClearEpoch = epoch;
      scopeEpochs.clear();
    } else {
      scopeEpochs.set(revisionScope, epoch);
    }
    revisionCache.delete(revisionScope);
  };
  const sharedRevisionHandle = {
    clear() {
      globalClearEpoch = nextEpoch++;
      scopeEpochs.clear();
      revisionCache.clear();
    },
  };
  // Keep sharedRevisionHandle referenced by the returned cache closure so WeakRef stays alive.
  registerSharedLocalCache(sharedRevisionHandle);
  const flight = createSingleFlight();

  async function writeCrossInstanceBump(revisionScope) {
    if (!process.env.REDIS_URL) return;
    const revTtl = resolveRevisionCacheMs(revisionCacheMs);
    const markerTtlSeconds = Math.max(15, Math.ceil(revTtl / 1000) + 15);
    try {
      await redisSetJson(bumpMarkerKey(revisionScope), { token: randomUUID(), bumpedAt: Date.now() }, markerTtlSeconds);
    } catch {
      // MongoDB durable counter remains source of truth if Redis is unreachable.
    }
  }

  async function readCrossInstanceBumpToken(revisionScope) {
    if (!process.env.REDIS_URL) return { available: true, token: null };
    let redis = null;
    try { redis = await getRedisClient(); } catch { redis = null; }
    if (!redis) return { available: false, token: null };
    const bump = await redisGetJson(bumpMarkerKey(revisionScope));
    return { available: true, token: typeof bump?.token === 'string' ? bump.token : null };
  }

  return {
    advance: async (args, options) => {
      const revisionScope = scope(...args);
      // Fence both already-in-flight loads and loads starting during the counter write.
      bumpScopeEpoch(revisionScope);
      const result = await advanceCacheCounter(revisionScope, options);
      bumpScopeEpoch(revisionScope);
      await writeCrossInstanceBump(revisionScope);
      return result;
    },
    // Every mutation advances the durable per-owner MongoDB counter and every
    // read keys L1 + Redis by `${scope}:${revision}`; skip global Redis PUBLISH
    // fanout per answer while immediately fencing L1 and stamping the per-scope
    // cross-instance Redis bump marker when Redis is configured.
    invalidate: async (...args) => {
      if (args.length) {
        try {
          const revisionScope = scope(...args);
          bumpScopeEpoch(revisionScope);
          await writeCrossInstanceBump(revisionScope);
        } catch {
          sharedRevisionHandle.clear();
        }
      } else {
        sharedRevisionHandle.clear();
      }
    },
    load: (args, build) => flight(scope(...args), async () => {
      const revisionScope = scope(...args);
      const revTtl = resolveRevisionCacheMs(revisionCacheMs);
      const cachedRev = revTtl > 0 ? revisionCache.get(revisionScope) : undefined;
      if (cachedRev && cachedRev.expiresAt > Date.now()) {
        const entryKey = `${revisionScope}:${cachedRev.revision}`;
        if (cache.hasFresh(entryKey)) {
          const bumpState = await readCrossInstanceBumpToken(revisionScope);
          if (!bumpState.available || bumpState.token !== cachedRev.bumpToken) {
            revisionCache.delete(revisionScope);
          } else {
            const peeked = cache.peekFresh(entryKey);
            if (peeked.hit) return peeked.value;
          }
        }
      }
      for (let attempt = 0; attempt < 3; attempt++) {
        const attemptEpoch = currentEpoch(revisionScope);
        const bumpBefore = revTtl > 0 ? await readCrossInstanceBumpToken(revisionScope) : { available: false, token: null };
        const revision = await getCacheCounter(revisionScope);
        const entryKey = `${revisionScope}:${revision}`;
        const peeked = cache.peekFresh(entryKey);
        if (peeked.hit) {
          if (currentEpoch(revisionScope) !== attemptEpoch) continue;
          if (revTtl > 0 && bumpBefore.available) {
            revisionCache.set(revisionScope, { revision, bumpToken: bumpBefore.token, expiresAt: Date.now() + revTtl });
          }
          return peeked.value;
        }
        const value = await cache.read(entryKey, build, { allowStale: false });
        if (await getCacheCounter(revisionScope) === revision) {
          if (currentEpoch(revisionScope) !== attemptEpoch) {
            revisionCache.delete(revisionScope);
            continue;
          }
          if (revTtl > 0 && bumpBefore.available) {
            revisionCache.set(revisionScope, { revision, bumpToken: bumpBefore.token, expiresAt: Date.now() + revTtl });
          }
          return value;
        }
        revisionCache.delete(revisionScope);
      }
      // Repeated concurrent writes should not turn an optional cache into a
      // dependency. Return a fresh source read without publishing that value.
      revisionCache.delete(revisionScope);
      observeCacheOperation({ cache: prefix, layer: 'source', outcome: 'miss' });
      return build();
    }),
    async read(...args) {
      const revisionScope = scope(...args);
      const revision = await getCacheCounter(revisionScope);
      const key = `${revisionScope}:${revision}`;
      const value = await redisGetJson(key);
      // A mutation may commit while the Redis GET is pending.
      if (value !== null && await getCacheCounter(revisionScope) !== revision) {
        revisionCache.delete(revisionScope);
        observeCacheOperation({ cache: prefix, layer: 'redis', outcome: 'miss' });
        return { key: null, value: null };
      }
      observeCacheOperation({ cache: prefix, layer: 'redis', outcome: value !== null ? 'hit' : 'miss' });
      return { key, value };
    },
    async write(key, value) {
      // A delayed builder only writes its original generation. New reads obtain
      // the durable generation first, even if Redis restores an older snapshot.
      if (key) await redisSetJson(key, value, ttlSeconds);
    },
  };
}
