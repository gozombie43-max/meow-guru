import { LRUCache } from 'lru-cache';
import { createHash } from 'node:crypto';
import { getCacheRevision, advanceCacheRevision } from '../repositories/cacheRevisionRepository.js';
import { redisGetJson, redisSetJson } from '../config/redis.js';
import { onCacheInvalidation, publishCacheInvalidation } from '../infrastructure/cacheInvalidation.js';

const local = new LRUCache({ max: 10000, ttl: 10000 });
const pending = new Map();
let generation = 0;
onCacheInvalidation(type => { if (type === 'notification.changed') { generation++; local.clear(); } });
const scope = userId => userId ? `notification:${userId}` : 'notification:all';
async function revision(userId) {
  const key = `revision:${scope(userId)}`;
  const shared = await redisGetJson(key);
  if (shared) return shared;
  // Missing Redis generations are read durably, never initialized to zero.
  const value = await getCacheRevision(scope(userId));
  await redisSetJson(key, value, 300);
  return value;
}
export async function invalidateNotificationUnread(userId) {
  generation++; local.clear();
  const value = await advanceCacheRevision(scope(userId));
  await redisSetJson(`revision:${scope(userId)}`, value, 300);
  await publishCacheInvalidation('notification.changed');
}

export async function cachedNotificationUnread(userId, build, { reconcile = false } = {}) {
  const owner = createHash('sha256').update(String(userId)).digest('hex');
  const existing = local.get(owner);
  if (!reconcile && existing?.validUntil > Date.now()) return existing.count;
  if (pending.has(owner)) return pending.get(owner);
  if (pending.size >= 256) throw Object.assign(new Error('Unread refresh capacity exceeded'), { statusCode: 503 });
  const work = (async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const currentGeneration = generation;
      const versions = await Promise.all([revision(), revision(userId)]);
      const key = `notification-unread:${owner}:${versions.join(':')}`;
      const cached = reconcile ? null : await redisGetJson(key);
      if (cached?.validUntil > Date.now() && currentGeneration === generation) { local.set(owner, cached); return cached.count; }
      const result = await build();
      const after = await Promise.all([revision(), revision(userId)]);
      if (currentGeneration !== generation || versions.join(':') !== after.join(':')) continue;
      const entry = { count: result.count, validUntil: Math.min(Date.now() + 30000, result.nextExpiry ? new Date(result.nextExpiry).getTime() : Infinity) };
      if (entry.validUntil <= Date.now()) continue;
      local.set(owner, entry);
      await redisSetJson(key, entry, Math.max(1, Math.ceil((entry.validUntil - Date.now()) / 1000)));
      return entry.count;
    }
    throw Object.assign(new Error('Notifications changed during refresh; retry'), { statusCode: 503 });
  })();
  pending.set(owner, work);
  try { return await work; } finally { if (pending.get(owner) === work) pending.delete(owner); }
}
