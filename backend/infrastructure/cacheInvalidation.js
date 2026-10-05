import { getRedisClient, redisKey } from '../config/redis.js';
import { clearSharedLocalCaches } from './tieredCache.js';

const listeners = new Set();
let subscriber;
export function onCacheInvalidation(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function invalidate(type = 'question.changed') { if (type === 'question.changed') clearSharedLocalCaches(); for (const listener of listeners) listener(type); }
export async function publishCacheInvalidation(type = 'question.changed') {
  invalidate(type);
  try {
    const redis = await getRedisClient();
    await redis?.publish(redisKey('cache-events'), JSON.stringify({ version: 1, type }));
  } catch { /* Mongo revision remains the durable source of truth. */ }
}
export async function startCacheInvalidationSubscriber() {
  if (subscriber) return;
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    subscriber = redis.duplicate();
    subscriber.on('error', () => {});
    await subscriber.connect();
    await subscriber.subscribe(redisKey('cache-events'), message => {
      try { const event = JSON.parse(message); if (event.version === 1 && typeof event.type === 'string') invalidate(event.type); } catch { /* ignore malformed advisory messages */ }
    });
  } catch { await closeCacheInvalidationSubscriber(); }
}
export async function closeCacheInvalidationSubscriber() {
  const previous = subscriber;
  subscriber = null;
  if (previous?.isOpen) await previous.destroy();
}
