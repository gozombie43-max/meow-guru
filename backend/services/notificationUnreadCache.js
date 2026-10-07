import { LRUCache } from 'lru-cache';
import { createHash } from 'node:crypto';
import { getCacheRevision, advanceCacheRevision } from '../repositories/cacheRevisionRepository.js';
import { withMongoTransaction } from '../config/mongodb.js';
import { redisGetJson, redisSetJson } from '../config/redis.js';
import { onCacheInvalidation, publishCacheInvalidation } from '../infrastructure/cacheInvalidation.js';
import { createSingleFlight } from '../infrastructure/singleFlight.js';

const local = new LRUCache({ max: 10000 });
const reads = createSingleFlight();
let generation = 0;
const clear = () => { generation++; local.clear(); };
onCacheInvalidation(type => { if (type === 'notification.changed') clear(); });
const owner = userId => createHash('sha256').update(String(userId)).digest('hex');
const scope = userId => userId == null ? 'notification:v2:global' : `notification:v2:user:${owner(userId)}`;
const versions = userId => Promise.all([getCacheRevision(scope()), getCacheRevision(scope(userId))]);

export async function invalidateNotificationUnread(userId) {
  await advanceCacheRevision(scope(userId));
  clear();
  await publishCacheInvalidation('notification.changed');
}

export async function commitNotificationMutation(userId, mutate) {
  const result = await withMongoTransaction(async ({ db, session }) => {
    const result = await mutate(db, session);
    if (result.insertedId || result.modifiedCount || result.upsertedCount) await advanceCacheRevision(scope(userId), { db, session });
    return result;
  });
  clear();
  await publishCacheInvalidation('notification.changed');
  return result;
}

export function cachedNotificationUnread(userId, build, { reconcile = false } = {}) {
  const id = owner(userId);
  return reads(JSON.stringify([id, reconcile]), async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const currentGeneration = generation;
      const currentVersions = JSON.stringify(await versions(userId));
      const key = `notification-unread:v2:${id}:${createHash('sha256').update(currentVersions).digest('hex')}`;
      const existing = local.get(id);
      if (!reconcile && existing?.versions === currentVersions && existing.validUntil > Date.now()) return existing.count;
      const cached = reconcile ? null : await redisGetJson(key);
      if (cached?.validUntil > Date.now() && currentGeneration === generation && JSON.stringify(await versions(userId)) === currentVersions) {
        local.set(id, cached, { ttl: cached.validUntil - Date.now() });
        return cached.count;
      }
      const result = await build();
      if (currentGeneration !== generation || currentVersions !== JSON.stringify(await versions(userId))) continue;
      const entry = { count: result.count, versions: currentVersions, validUntil: Math.min(Date.now() + 30000, result.nextExpiry ? new Date(result.nextExpiry).getTime() : Infinity) };
      if (entry.validUntil <= Date.now()) continue;
      local.set(id, entry, { ttl: entry.validUntil - Date.now() });
      await redisSetJson(key, entry, Math.max(1, Math.ceil((entry.validUntil - Date.now()) / 1000)));
      return entry.count;
    }
    return (await build()).count;
  });
}
