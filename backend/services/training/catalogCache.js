// Database identity isolates test/reconnect instances. Expiration also covers
// imports made outside this process; application writes invalidate immediately.
import { createHash } from 'node:crypto';
import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { getQuestionRevision } from '../questions/questionCache.js';

let databases = new WeakMap();
export function invalidateTrainingCatalog() { databases = new WeakMap(); }
export async function cachedTrainingCatalog(db, key, build) {
  let entries = databases.get(db);
  if (!entries) { entries = new Map(); databases.set(db, entries); }
  const revision = await getQuestionRevision();
  const versionKey = `${key}:${revision}`;
  const cached = entries.get(versionKey);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const entry = { expires: Date.now() + 10_000, promise: Promise.resolve().then(async () => {
    const sharedKey = `training-catalog:${revision}:${createHash('sha256').update(key).digest('hex')}`;
    let cache = entries.get('__cache');
    if (!cache) { cache = createTieredCache({ freshMs: 1800000, staleMs: 1800000 }); entries.set('__cache', cache); }
    return cache.read(sharedKey, build, { allowStale: false });
  }) };
  if (entries.size > 300) entries.clear();
  entries.set(versionKey, entry);
  try { return await entry.promise; }
  catch (error) { if (entries.get(versionKey) === entry) entries.delete(versionKey); throw error; }
}
