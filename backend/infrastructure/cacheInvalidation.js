import { createClient } from 'redis';
import { getRedisClient, redisKey, reportRedisFailure } from '../config/redis.js';
import { clearSharedLocalCaches } from './tieredCache.js';

const listeners = new Set();
const scopedHandlers = new Map();
let subscriber, connecting, retryTimer;
let stopping = false;
let state = 'disconnected', lastInvalidationReceivedAt = null, reconnectCount = 0;
let activeScopedInvalidation = null;
const MAX_SCOPED_QUESTION_UIDS = 200;
const backoff = attempt => Math.min(10000, Math.round(100 * 2 ** Math.min(attempt, 7) * (0.8 + Math.random() * 0.4)));

function boundedString(value, max = 128) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : undefined;
}

export function normalizeInvalidationScope(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const scope = {};
  const subject = boundedString(raw.subject, 120);
  const topic = boundedString(raw.topic, 120);
  const exam = boundedString(raw.exam, 120);
  const sessionId = boundedString(raw.sessionId, 128);
  if (subject) scope.subject = subject;
  if (topic) scope.topic = topic;
  if (exam) scope.exam = exam;
  if (sessionId) scope.sessionId = sessionId;
  if (Array.isArray(raw.questionUids)) {
    const uids = [...new Set(raw.questionUids.map(id => boundedString(String(id ?? ''), 128)).filter(Boolean))];
    // Bulk mutations exceeding the bounded UID budget must fall back to a full unscoped
    // invalidation instead of silently dropping UIDs 201+ and leaving stale L1 entries.
    if (uids.length > MAX_SCOPED_QUESTION_UIDS) return null;
    if (uids.length) scope.questionUids = uids;
  }
  return Object.keys(scope).length ? scope : null;
}

export function getActiveScopedInvalidation() {
  return activeScopedInvalidation;
}

export function cacheInvalidationHealth() {
  return { state: !process.env.REDIS_URL ? 'disabled' : state, lastInvalidationReceivedAt, reconnectCount };
}
export function onCacheInvalidation(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function onScopedCacheInvalidation(type, handler) {
  if (typeof type !== 'string' || !type || typeof handler !== 'function') return () => {};
  let set = scopedHandlers.get(type);
  if (!set) { set = new Set(); scopedHandlers.set(type, set); }
  set.add(handler);
  return () => {
    set.delete(handler);
    if (!set.size) scopedHandlers.delete(type);
  };
}
function invalidate(type = 'question.changed', rawScope = undefined) {
  const scope = normalizeInvalidationScope(rawScope);
  const handlers = scopedHandlers.get(type);
  const handledScoped = Boolean(scope && handlers && handlers.size > 0);
  if (handledScoped) {
    for (const handler of handlers) {
      try { handler(scope); } catch { /* Scoped cache eviction must not break other handlers. */ }
    }
  } else if (type === 'question.changed') {
    clearSharedLocalCaches();
  }
  const previousActive = activeScopedInvalidation;
  activeScopedInvalidation = handledScoped ? { type, scope } : null;
  try {
    for (const listener of listeners) {
      if (scope) listener(type, scope);
      else listener(type);
    }
  } finally {
    activeScopedInvalidation = previousActive;
  }
}
function reconcile() {
  // Clear advisory L1 state after a gap. Durable revisions still decide validity.
  invalidate('question.changed');
  invalidate('quiz-session.changed');
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
export async function publishCacheInvalidation(type = 'question.changed', rawScope = undefined) {
  const scope = normalizeInvalidationScope(rawScope);
  invalidate(type, scope);
  try {
    const redis = await getRedisClient();
    const payload = scope ? { version: 1, type, ...scope } : { version: 1, type };
    await redis?.publish(redisKey('cache-events'), JSON.stringify(payload));
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
            const scope = normalizeInvalidationScope(event.scope || event);
            invalidate(event.type, scope);
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
