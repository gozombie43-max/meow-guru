// Database identity isolates test/reconnect instances. Expiration also covers
// imports made outside this process; application writes invalidate immediately.
import { createHash } from 'node:crypto';
import { redisGetJson, redisSetJson } from '../../config/redis.js';
import { getQuestionRevision } from '../questions/questionCache.js';

let databases = new WeakMap();
export function invalidateTrainingCatalog() { databases = new WeakMap(); }
export async function cachedTrainingCatalog(db, key, build) {
  let entries = databases.get(db);
  if (!entries) { entries = new Map(); databases.set(db, entries); }
  const cached = entries.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const entry = { expires: Date.now() + 5 * 60 * 1000, promise: Promise.resolve().then(async () => {
    const revision = await getQuestionRevision();
    const sharedKey = `training-catalog:${revision}:${createHash('sha256').update(key).digest('hex')}`;
    const shared = await redisGetJson(sharedKey);
    if (shared) return shared;
    const value = await build();
    await redisSetJson(sharedKey, value, 300);
    return value;
  }) };
  entries.set(key, entry);
  try { return await entry.promise; }
  catch (error) { if (entries.get(key) === entry) entries.delete(key); throw error; }
}
