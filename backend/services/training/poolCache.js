import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { redisGetEjson, redisSetEjson } from '../../config/redis.js';

const databases = new WeakMap();

export function cachedTrainingPool(db, key, build) {
  let cache = databases.get(db);
  if (!cache) {
    // EJSON preserves Mongo ObjectIds required by selected-question hydration.
    // Revisioned keys are supplied by the repository; stale pools are never used.
    cache = createTieredCache({ freshMs: 60000, staleMs: 60000, getShared: redisGetEjson, setShared: redisSetEjson });
    databases.set(db, cache);
  }
  return cache.read(key, build, { allowStale: false });
}
