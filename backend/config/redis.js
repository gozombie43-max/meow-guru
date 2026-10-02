import { createClient } from 'redis';
import { createHash } from 'node:crypto';
import { BSON } from 'mongodb';
import { withTrace } from '../infrastructure/tracing.js';
import { dependencyLatency, dependencyErrors } from '../infrastructure/metrics.js';

// Instrument the installed Redis client directly; never export keys or values.
const measuredCommands = new Set(['get', 'set', 'mGet', 'del', 'eval', 'incr', 'expire', 'publish']);
function observeRedis(target) {
  const methods = new Map();
  return new Proxy(target, { get(client, name) {
    const value = Reflect.get(client, name, client);
    if (typeof value !== 'function') return value;
    if (!methods.has(name)) methods.set(name, measuredCommands.has(name) ? (...args) => withTrace(`redis.${name}`, { 'dependency.name': 'redis', 'db.operation.name': name }, async () => {
      const started = performance.now();
      try { return await value.apply(client, args); }
      catch (error) { dependencyErrors.inc({ dependency: 'redis' }); throw error; }
      finally { dependencyLatency.observe({ dependency: 'redis', operation: name }, (performance.now() - started) / 1000); }
    }) : value.bind(client));
    return methods.get(name);
  } });
}

let client;
let connecting;
let retryAfter = 0;
let lastWarning = 0;
export function redisHealth() { return !process.env.REDIS_URL ? 'disabled' : client?.isReady ? 'healthy' : 'degraded'; }

export function reportRedisFailure() {
  if (Date.now() - lastWarning < 30_000) return;
  lastWarning = Date.now();
  console.warn('Redis unavailable; using MongoDB fallback where required');
}

export async function getRedisClient() {
  if (!process.env.REDIS_URL || Date.now() < retryAfter) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;
  if (client?.isOpen) await client.destroy();
  client = null;

  let candidate;
  try {
    candidate = createClient({
      url: process.env.REDIS_URL,
      disableOfflineQueue: true,
      commandsQueueMaxLength: 256,
      commandOptions: { timeout: 1000 },
      socket: { connectTimeout: 1000, reconnectStrategy: false },
    });
  } catch {
    retryAfter = Date.now() + 30_000;
    reportRedisFailure();
    return null;
  }
  candidate.on('error', () => {});
  connecting = candidate.connect().then(() => {
    client = observeRedis(candidate);
    return client;
  }).catch(async () => {
    retryAfter = Date.now() + 30_000;
    reportRedisFailure();
    await candidate.destroy();
    return null;
  }).finally(() => { connecting = null; });
  return connecting;
}

export async function closeRedisClient() {
  await connecting?.catch(() => {});
  const active = client;
  client = null;
  if (active?.isOpen) await active.destroy();
}

export function redisKey(suffix) {
  const source = `${process.env.MONGODB_URI || ''}:${process.env.MONGODB_DB || 'quizDB'}`;
  const isolatedDefault = `meow:${createHash('sha256').update(source).digest('hex').slice(0, 16)}`;
  return `${process.env.REDIS_NAMESPACE || isolatedDefault}:v1:${suffix}`;
}

export async function redisGetJson(key) {
  try {
    const redis = await getRedisClient();
    const value = redis && await redis.get(redisKey(key));
    return value == null ? null : JSON.parse(value);
  } catch {
    reportRedisFailure();
    return null;
  }
}

export async function redisGetJsonMany(keys) {
  if (!keys.length) return [];
  try {
    const redis = await getRedisClient();
    if (!redis) return keys.map(() => null);
    return (await redis.mGet(keys.map(redisKey))).map(value => {
      try { return value == null ? null : JSON.parse(value); } catch { return null; }
    });
  } catch { reportRedisFailure(); return keys.map(() => null); }
}

export async function redisSetJson(key, value, ttlSeconds) {
  try {
    const redis = await getRedisClient();
    if (redis) await redis.set(redisKey(key), JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    reportRedisFailure();
    // Redis is an optional read cache; MongoDB remains authoritative.
  }
}

export async function redisDelete(...keys) {
  if (!keys.length) return;
  try {
    const redis = await getRedisClient();
    if (redis) await redis.del(keys.map(redisKey));
  } catch {
    reportRedisFailure();
  }
}

export async function redisGetEjson(key) {
  try {
    const redis = await getRedisClient();
    const value = redis && await redis.get(redisKey(key));
    return value == null ? null : BSON.EJSON.parse(value);
  } catch {
    reportRedisFailure();
    return null;
  }
}

export async function redisSetEjson(key, value, ttlSeconds, maxBytes = 2 * 1024 * 1024) {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    const encoded = BSON.EJSON.stringify(value);
    if (Buffer.byteLength(encoded) <= maxBytes) {
      await redis.set(redisKey(key), encoded, { EX: ttlSeconds });
    }
  } catch {
    reportRedisFailure();
  }
}
