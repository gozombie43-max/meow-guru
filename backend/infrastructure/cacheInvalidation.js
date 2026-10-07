import { createClient } from 'redis';
import { getRedisClient, redisKey, reportRedisFailure } from '../config/redis.js';
import { clearSharedLocalCaches } from './tieredCache.js';

const listeners = new Set();
let subscriber, connecting, retryTimer;
let stopping = false;
let state = 'disconnected', lastInvalidationReceivedAt = null, reconnectCount = 0;
const backoff = attempt => Math.min(10000, Math.round(100 * 2 ** Math.min(attempt, 7) * (0.8 + Math.random() * 0.4)));

export function cacheInvalidationHealth() {
  return { state: !process.env.REDIS_URL ? 'disabled' : state, lastInvalidationReceivedAt, reconnectCount };
}
export function onCacheInvalidation(listener) { listeners.add(listener); return () => listeners.delete(listener); }
function invalidate(type = 'question.changed') {
  if (type === 'question.changed') clearSharedLocalCaches();
  for (const listener of listeners) listener(type);
}
function reconcile() {
  // Clear advisory L1 state after a gap. Durable revisions still decide validity.
  invalidate('question.changed');
  invalidate('notification.changed');
}
function scheduleRetry() {
  if (stopping || retryTimer || !process.env.REDIS_URL) return;
  state = 'reconnecting';
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    reconnectCount++;
    void startCacheInvalidationSubscriber();
  }, backoff(5));
  retryTimer.unref();
}
export async function publishCacheInvalidation(type = 'question.changed') {
  invalidate(type);
  try {
    const redis = await getRedisClient();
    await redis?.publish(redisKey('cache-events'), JSON.stringify({ version: 1, type }));
  } catch { /* Mongo revision remains the durable source of truth. */ }
}
export async function startCacheInvalidationSubscriber() {
  if (!process.env.REDIS_URL || stopping) return;
  if (connecting) return connecting;
  if (subscriber?.isOpen) return;
  clearTimeout(retryTimer);
  retryTimer = undefined;
  connecting = (async () => {
    let candidate, timer;
    state = 'connecting';
    try {
      candidate = createClient({
        url: process.env.REDIS_URL,
        name: redisKey('cache-invalidation-subscriber'),
        disableOfflineQueue: true,
        commandOptions: { timeout: 1000 },
        socket: { connectTimeout: 1000, reconnectStrategy: backoff },
      });
      subscriber = candidate;
      let subscribed = false;
      candidate.on('error', () => { if (subscriber === candidate) { state = 'reconnecting'; reconcile(); reportRedisFailure(); } });
      candidate.on('reconnecting', () => { if (subscriber === candidate) { state = 'reconnecting'; reconnectCount++; } });
      candidate.on('ready', () => { if (subscriber === candidate) { state = subscribed ? 'subscribed' : 'ready'; reconcile(); } });
      candidate.on('end', () => {
        if (subscriber !== candidate) return;
        subscriber = undefined;
        state = 'disconnected';
        reconcile();
        scheduleRetry();
      });
      await Promise.race([
        candidate.connect(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Cache subscriber connection timed out')), 3000); }),
      ]);
      if (stopping || subscriber !== candidate) return;
      await candidate.subscribe(redisKey('cache-events'), raw => {
        try {
          const event = JSON.parse(raw);
          if (event.version === 1 && typeof event.type === 'string') {
            lastInvalidationReceivedAt = new Date().toISOString();
            invalidate(event.type);
          }
        } catch { /* Ignore malformed advisory events. */ }
      });
      subscribed = true;
      state = 'subscribed';
    } catch {
      if (subscriber === candidate) subscriber = undefined;
      candidate?.destroy();
      reportRedisFailure();
      scheduleRetry();
    } finally { clearTimeout(timer); }
  })();
  try { await connecting; } finally { connecting = undefined; }
}
export async function closeCacheInvalidationSubscriber() {
  stopping = true;
  clearTimeout(retryTimer);
  retryTimer = undefined;
  const previous = subscriber;
  subscriber = undefined;
  previous?.destroy();
  await connecting;
  state = 'disconnected';
}
