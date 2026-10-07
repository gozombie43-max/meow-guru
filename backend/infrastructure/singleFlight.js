// Keep only in-flight work, never an auth failure or an expiring source value.
export function createSingleFlight(maxKeys = 256) {
  const pending = new Map();
  return async (key, work) => {
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= maxKeys) throw Object.assign(new Error('Read capacity exceeded'), { statusCode: 503 });
    const promise = Promise.resolve().then(work);
    pending.set(key, promise);
    try { return await promise; }
    finally { if (pending.get(key) === promise) pending.delete(key); }
  };
}
