// Database identity isolates test/reconnect instances. Expiration also covers
// imports made outside this process; application writes invalidate immediately.
let databases = new WeakMap();
export function invalidateTrainingCatalog() { databases = new WeakMap(); }
export async function cachedTrainingCatalog(db, key, build) {
  let entries = databases.get(db);
  if (!entries) { entries = new Map(); databases.set(db, entries); }
  const cached = entries.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const entry = { expires: Date.now() + 5 * 60 * 1000, promise: Promise.resolve().then(build) };
  entries.set(key, entry);
  try { return await entry.promise; }
  catch (error) { if (entries.get(key) === entry) entries.delete(key); throw error; }
}
