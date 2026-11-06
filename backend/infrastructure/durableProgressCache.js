import { LRUCache } from 'lru-cache';
import { getCacheCounter, advanceCacheCounter } from '../repositories/cacheRevisionRepository.js';
import { redisGetJson, redisSetJson } from '../config/redis.js';
import { JSON_CACHE_MAX_BYTES } from './cacheEncoding.js';
import { createTieredCache } from './tieredCache.js';
import { createSingleFlight } from './singleFlight.js';

export function createDurableProgressCache(prefix, owner, ttlSeconds, { validUntil = () => Infinity, maxEntries = 2000 } = {}) {
  const scope = (...args) => `${prefix}:v2:${owner(...args)}`;
  const cache = createTieredCache({
    freshMs: ttlSeconds * 1000,
    staleMs: ttlSeconds * 1000,
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
  const flight = createSingleFlight();
  return {
    advance: (args, options) => advanceCacheCounter(scope(...args), options),
    // Every mutation advances the durable per-owner MongoDB counter and every
    // read keys L1 + Redis by `${scope}:${revision}`; no subscriber listens to
    // `${prefix}.changed`, so skip global Redis PUBLISH fanout per answer.
    invalidate: async () => {},
    load: (args, build) => flight(scope(...args), async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const revisionScope = scope(...args);
        const revision = await getCacheCounter(revisionScope);
        const value = await cache.read(`${revisionScope}:${revision}`, build, { allowStale: false });
        if (await getCacheCounter(revisionScope) === revision) return value;
      }
      // Repeated concurrent writes should not turn an optional cache into a
      // dependency. Return a fresh source read without publishing that value.
      return build();
    }),
    async read(...args) {
      const revisionScope = scope(...args);
      const revision = await getCacheCounter(revisionScope);
      const key = `${revisionScope}:${revision}`;
      const value = await redisGetJson(key);
      // A mutation may commit while the Redis GET is pending.
      if (value !== null && await getCacheCounter(revisionScope) !== revision) return { key: null, value: null };
      return { key, value };
    },
    async write(key, value) {
      // A delayed builder only writes its original generation. New reads obtain
      // the durable generation first, even if Redis restores an older snapshot.
      if (key) await redisSetJson(key, value, ttlSeconds);
    },
  };
}
