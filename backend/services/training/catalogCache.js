// Database identity isolates test/reconnect instances. Expiration also covers
// imports made outside this process; application writes invalidate immediately.
import { createHash } from 'node:crypto';
import { createTieredCache } from '../../infrastructure/tieredCache.js';
import { getQuestionRevision, clearQuestionRevisionCache } from '../questions/questionCache.js';

let databases = new WeakMap();
export function invalidateTrainingCatalog() {
  databases = new WeakMap();
  clearQuestionRevisionCache();
}
export async function cachedTrainingCatalog(db, key, build) {
  let cache = databases.get(db);
  if (!cache) { cache = createTieredCache({ freshMs: 1800000, staleMs: 1800000 }); databases.set(db, cache); }
  const revision = await getQuestionRevision();
  const sharedKey = `training-catalog:${revision}:${createHash('sha256').update(key).digest('hex')}`;
  return cache.read(sharedKey, build, { allowStale: false });
}
