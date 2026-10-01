import { createClient } from 'redis';
import { createHash } from 'node:crypto';
import { BSON } from 'mongodb';

let client;
let connecting;
let retryAfter = 0;
let lastWarning = 0;

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
      socket: { connectTimeout: 1000, reconnectStrategy: false },
    });
  } catch {
    retryAfter = Date.now() + 30_000;
    reportRedisFailure();
    return null;
  }
  candidate.on('error', () => {});
  connecting = candidate.connect().then(() => {
    client = candidate;
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
