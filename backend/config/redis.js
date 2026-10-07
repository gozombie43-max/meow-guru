import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { createClient } from 'redis';
import { createHash } from 'node:crypto';
import { BSON } from 'mongodb';
import { withTrace } from '../infrastructure/tracing.js';
import { dependencyLatency, dependencyErrors } from '../infrastructure/metrics.js';
import { redisCircuitState, redisCommandTimeouts, redisFallbacks } from '../infrastructure/metrics.js';
import { createRedisCircuit } from '../infrastructure/redisCircuit.js';
import { encodeCacheValue, JSON_CACHE_MAX_BYTES, EJSON_CACHE_MAX_BYTES } from '../infrastructure/cacheEncoding.js';
import { writeWithLease } from '../infrastructure/cacheLease.js';

const circuit = createRedisCircuit();
export function redisCircuitHealth() { return circuit.state(); }
function updateCircuitMetric() { redisCircuitState.set({ closed: 0, open: 1, 'half-open': 2 }[circuit.state()]); }
function commandFailed(error) {
  circuit.failure(); updateCircuitMetric();
  if (/timeout/i.test(`${error?.name} ${error?.message}`)) redisCommandTimeouts.inc();
}

// Instrument the installed Redis client directly; never export keys or values.
const measuredCommands = new Set(['get', 'set', 'mGet', 'del', 'eval', 'incr', 'expire', 'publish']);
function observeRedis(target) {
  const methods = new Map();
  return new Proxy(target, { get(client, name) {
    const value = Reflect.get(client, name, client);
    if (typeof value !== 'function') return value;
    if (!methods.has(name)) methods.set(name, measuredCommands.has(name) ? (...args) => withTrace(`redis.${name}`, { 'dependency.name': 'redis', 'db.operation.name': name }, async () => {
      const started = performance.now();
      try {
        if (circuit.state() !== 'closed') throw Object.assign(new Error('Optional Redis circuit is open'), { code: 'REDIS_CIRCUIT_OPEN' });
        return await value.apply(client, args);
      }
      catch (error) { if (error.code !== 'REDIS_CIRCUIT_OPEN') commandFailed(error); dependencyErrors.inc({ dependency: 'redis' }); throw error; }
      finally { dependencyLatency.observe({ dependency: 'redis', operation: name }, (performance.now() - started) / 1000); }
    }) : value.bind(client));
    return methods.get(name);
  } });
}

let client;
let connecting;
let lastWarning = 0;
export function redisHealth() { return !process.env.REDIS_URL ? 'disabled' : client?.isReady && circuit.state() === 'closed' ? 'healthy' : 'degraded'; }

export function reportRedisFailure() {
  if (Date.now() - lastWarning < 30_000) return;
  lastWarning = Date.now();
  runtimeLog.warn('Redis unavailable; using source reads or local emergency limits');
}

export async function getRedisClient() {
  if (!process.env.REDIS_URL) return null;
  const admission = circuit.admit(); updateCircuitMetric();
  if (admission === 'skip') { redisFallbacks.inc(); return null; }
  if (admission === 'probe' && client?.isReady) {
    try { await client.ping(); circuit.recovered(); updateCircuitMetric(); return client; }
    catch (error) { commandFailed(error); reportRedisFailure(); redisFallbacks.inc(); return null; }
  }
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
    circuit.unavailable(); updateCircuitMetric();
    reportRedisFailure();
    return null;
  }
  candidate.on('error', () => {});
  connecting = candidate.connect().then(() => {
    circuit.recovered(); updateCircuitMetric();
    client = observeRedis(candidate);
    return client;
  }).catch(async error => {
    commandFailed(error);
    // A failed connection is enough to bypass all subsequent connection attempts.
    circuit.unavailable(); updateCircuitMetric();
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
  circuit.reset(); updateCircuitMetric();
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
    return value == null || Buffer.byteLength(value) > JSON_CACHE_MAX_BYTES ? null : JSON.parse(value);
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
      try { return value == null || Buffer.byteLength(value) > JSON_CACHE_MAX_BYTES ? null : JSON.parse(value); } catch { return null; }
    });
  } catch { reportRedisFailure(); return keys.map(() => null); }
}

export async function redisSetJson(key, value, ttlSeconds, options = {}) {
  return storeCacheValue(key, value, ttlSeconds, 'json', JSON_CACHE_MAX_BYTES, options);
}

async function storeCacheValue(key, value, ttlSeconds, format, maxBytes, { lease } = {}) {
  try {
    const redis = await getRedisClient();
    if (!redis) return false;
    const encoded = encodeCacheValue(value, format, maxBytes);
    if (!encoded || !Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0) return false;
    if (lease) return Boolean(await redis.eval(writeWithLease, {
      keys: [lease.lockKey, lease.fenceKey, redisKey(key)],
      arguments: [lease.owner, String(lease.fence), encoded.encoded, String(ttlSeconds)],
    }));
    await redis.set(redisKey(key), encoded.encoded, { EX: ttlSeconds });
    return true;
  } catch {
    reportRedisFailure();
    // Redis is an optional read cache; MongoDB remains authoritative.
    return false;
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
    return value == null || Buffer.byteLength(value) > EJSON_CACHE_MAX_BYTES ? null : BSON.EJSON.parse(value);
  } catch {
    reportRedisFailure();
    return null;
  }
}

export async function redisSetEjson(key, value, ttlSeconds, budgetOrOptions = EJSON_CACHE_MAX_BYTES) {
  return storeCacheValue(key, value, ttlSeconds, 'ejson',
    typeof budgetOrOptions === 'number' ? Math.min(budgetOrOptions, EJSON_CACHE_MAX_BYTES) : EJSON_CACHE_MAX_BYTES,
    typeof budgetOrOptions === 'object' ? budgetOrOptions : {});
}
