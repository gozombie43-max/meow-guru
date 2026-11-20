import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { createClient } from 'redis';
import { createHash } from 'node:crypto';
import { BSON } from 'mongodb';
import { withTrace } from '../infrastructure/tracing.js';
import { dependencyLatency, dependencyErrors, redisCircuitState, redisCommandTimeouts, redisFallbacks } from '../infrastructure/metrics.js';
import { createRedisCircuit } from '../infrastructure/redisCircuit.js';
import { encodeCacheValue, JSON_CACHE_MAX_BYTES, EJSON_CACHE_MAX_BYTES } from '../infrastructure/cacheEncoding.js';
import { writeWithLease } from '../infrastructure/cacheLease.js';

const DEFAULT_COMMANDS_QUEUE_MAX = 2048;
const DEFAULT_COMMAND_TIMEOUT_MS = 1000;
const DEFAULT_CONSECUTIVE_TIMEOUT_THRESHOLD = 3;
const SERVER_INFO_CACHE_TTL_MS = 30_000;

function readBoundedInt(envName, fallback, min, max) {
  const raw = process.env[envName];
  if (raw === undefined || raw === null) return fallback;
  const trimmed = String(raw).trim();
  if (!trimmed) return fallback;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

export function getRedisCommandsQueueMaxLength() {
  return readBoundedInt('REDIS_COMMANDS_QUEUE_MAX', DEFAULT_COMMANDS_QUEUE_MAX, 256, 65536);
}

function getCommandTimeoutMs() {
  return readBoundedInt('REDIS_COMMAND_TIMEOUT_MS', DEFAULT_COMMAND_TIMEOUT_MS, 200, 10_000);
}

function getConsecutiveTimeoutThreshold() {
  return readBoundedInt('REDIS_CONSECUTIVE_TIMEOUT_THRESHOLD', DEFAULT_CONSECUTIVE_TIMEOUT_THRESHOLD, 1, 20);
}

const quotaExceeded = error => /max requests limit exceeded/i.test(error?.message || '');

// Bound the full command round-trip, since node-redis timeouts only cover queue wait.
// Only destroy the shared socket when explicitly requested (e.g. stalled handshake/probe)
// or when consecutive timeouts breach the circuit threshold, preventing a single slow
// reply from tearing down healthy in-flight work for 500 concurrent users.
async function redisDeadline(work, connection, { destroyOnTimeout = false, timeoutMs = getCommandTimeoutMs() } = {}) {
  let timer;
  try {
    return await Promise.race([
      Promise.resolve().then(work),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          reject(Object.assign(new Error('Redis command timeout'), { name: 'TimeoutError', code: 'REDIS_COMMAND_TIMEOUT' }));
          if (destroyOnTimeout) {
            try { connection?.destroy(); } catch { /* The socket may already be closed. */ }
          }
        }, timeoutMs);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

// Instrument the installed Redis client directly; never export keys or values.
const measuredCommands = new Set(['get', 'set', 'mGet', 'del', 'eval', 'incr', 'expire', 'publish']);

let lastWarning = 0;

export function reportRedisFailure() {
  if (Date.now() - lastWarning < 30_000) return;
  lastWarning = Date.now();
  runtimeLog.warn('Redis unavailable; using source reads or local emergency limits');
}

function createRedisSlot({ role = 'cache', recordCircuitMetric = false } = {}) {
  const circuit = createRedisCircuit();
  const dependencyLabel = role === 'cache' ? 'redis' : `redis.${role}`;
  let client = null;
  let rawClient = null;
  let connecting = null;
  let consecutiveTimeouts = 0;
  let totalTimeouts = 0;

  function updateCircuitMetric() {
    if (!recordCircuitMetric) return;
    redisCircuitState.set({ closed: 0, open: 1, 'half-open': 2 }[circuit.state()]);
  }

  function destroySocket(connection) {
    try { connection?.destroy(); } catch { /* The socket may already be closed. */ }
    if (connection && connection === rawClient) {
      client = null;
      rawClient = null;
    }
  }

  function commandSucceeded() {
    consecutiveTimeouts = 0;
  }

  function commandFailed(error, connection) {
    const isDeadlineTimeout = error?.code === 'REDIS_COMMAND_TIMEOUT';
    const isTimeout = isDeadlineTimeout || /timeout/i.test(`${error?.name} ${error?.message}`);
    if (quotaExceeded(error)) {
      circuit.unavailable(5 * 60 * 1000);
    } else if (isDeadlineTimeout) {
      consecutiveTimeouts++;
      totalTimeouts++;
      circuit.failure();
      if (consecutiveTimeouts >= getConsecutiveTimeoutThreshold() || circuit.state() === 'open') {
        circuit.unavailable();
        destroySocket(connection);
      }
    } else {
      if (isTimeout) totalTimeouts++;
      circuit.failure();
    }
    updateCircuitMetric();
    if (isTimeout) redisCommandTimeouts.inc();
  }

  function observeRedis(target) {
    const methods = new Map();
    return new Proxy(target, {
      get(inner, name) {
        const value = Reflect.get(inner, name, inner);
        if (typeof value !== 'function') return value;
        if (!methods.has(name)) {
          methods.set(name, measuredCommands.has(name) ? (...args) => withTrace(`${dependencyLabel}.${name}`, { 'dependency.name': dependencyLabel, 'db.operation.name': name }, async () => {
            const started = performance.now();
            try {
              if (circuit.state() !== 'closed') throw Object.assign(new Error('Optional Redis circuit is open'), { code: 'REDIS_CIRCUIT_OPEN' });
              const result = await redisDeadline(() => value.apply(inner, args), inner, { destroyOnTimeout: false });
              commandSucceeded();
              return result;
            } catch (error) {
              if (error.code !== 'REDIS_CIRCUIT_OPEN') commandFailed(error, inner);
              dependencyErrors.inc({ dependency: dependencyLabel });
              throw error;
            } finally {
              dependencyLatency.observe({ dependency: dependencyLabel, operation: name }, (performance.now() - started) / 1000);
            }
          }) : value.bind(inner));
        }
        return methods.get(name);
      },
    });
  }

  async function getClient() {
    if (!process.env.REDIS_URL) return null;
    const admission = circuit.admit(); updateCircuitMetric();
    if (admission === 'skip') { redisFallbacks.inc(); return null; }
    if (admission === 'probe' && client?.isReady) {
      try {
        await redisDeadline(() => client.ping(), rawClient || client, { destroyOnTimeout: true });
        consecutiveTimeouts = 0;
        circuit.recovered(); updateCircuitMetric();
        return client;
      } catch (error) {
        commandFailed(error, rawClient || client);
        reportRedisFailure();
        redisFallbacks.inc();
        return null;
      }
    }
    if (client?.isReady) return client;
    if (connecting) return connecting;
    if (client?.isOpen) await client.destroy();
    client = null;
    rawClient = null;

    let candidate;
    try {
      candidate = createClient({
        url: process.env.REDIS_URL,
        disableOfflineQueue: true,
        commandsQueueMaxLength: getRedisCommandsQueueMaxLength(),
        commandOptions: { timeout: getCommandTimeoutMs() },
        socket: { connectTimeout: 1000, reconnectStrategy: false },
      });
    } catch {
      circuit.unavailable(); updateCircuitMetric();
      reportRedisFailure();
      return null;
    }
    candidate.on('error', () => {});
    connecting = redisDeadline(() => candidate.connect(), candidate, { destroyOnTimeout: true }).then(() => {
      consecutiveTimeouts = 0;
      circuit.recovered(); updateCircuitMetric();
      rawClient = candidate;
      client = observeRedis(candidate);
      return client;
    }).catch(async error => {
      commandFailed(error, candidate);
      // A failed connection is enough to bypass all subsequent connection attempts.
      if (!quotaExceeded(error)) circuit.unavailable();
      updateCircuitMetric();
      reportRedisFailure();
      await candidate.destroy();
      return null;
    }).finally(() => { connecting = null; });
    return connecting;
  }

  async function close() {
    await connecting?.catch(() => {});
    const active = client;
    client = null;
    rawClient = null;
    consecutiveTimeouts = 0;
    circuit.reset(); updateCircuitMetric();
    if (active?.isOpen) await active.destroy();
  }

  return {
    getClient,
    close,
    circuitHealth: () => circuit.state(),
    health: () => !process.env.REDIS_URL ? 'disabled' : client?.isReady && circuit.state() === 'closed' ? 'healthy' : 'degraded',
    stats: () => ({
      role,
      health: !process.env.REDIS_URL ? 'disabled' : client?.isReady && circuit.state() === 'closed' ? 'healthy' : 'degraded',
      circuit: circuit.state(),
      ready: Boolean(client?.isReady),
      consecutiveTimeouts,
      totalTimeouts,
    }),
  };
}

const cacheSlot = createRedisSlot({ role: 'cache', recordCircuitMetric: true });
const rateLimitSlot = createRedisSlot({ role: 'ratelimit', recordCircuitMetric: false });

export function redisCircuitHealth() { return cacheSlot.circuitHealth(); }
export function redisHealth() { return cacheSlot.health(); }
export function getRedisClient() { return cacheSlot.getClient(); }

export function rateLimitRedisCircuitHealth() { return rateLimitSlot.circuitHealth(); }
export function rateLimitRedisHealth() { return rateLimitSlot.health(); }
export function getRateLimitRedisClient() { return rateLimitSlot.getClient(); }

let cachedServerInfo = null;
let serverInfoUpdatedAt = 0;

export async function closeRedisClient() {
  cachedServerInfo = null;
  serverInfoUpdatedAt = 0;
  await Promise.all([cacheSlot.close(), rateLimitSlot.close()]);
}

function parseRedisInfo(raw) {
  const fields = {};
  for (const line of String(raw || '').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes(':')) continue;
    const idx = line.indexOf(':');
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  const hits = Number(fields.keyspace_hits);
  const misses = Number(fields.keyspace_misses);
  const totalLookups = (Number.isFinite(hits) ? hits : 0) + (Number.isFinite(misses) ? misses : 0);
  return {
    usedMemoryBytes: Number.isFinite(Number(fields.used_memory)) ? Number(fields.used_memory) : null,
    usedMemoryHuman: fields.used_memory_human || null,
    maxMemoryBytes: Number.isFinite(Number(fields.maxmemory)) ? Number(fields.maxmemory) : null,
    maxMemoryHuman: fields.maxmemory_human || null,
    maxMemoryPolicy: fields.maxmemory_policy || null,
    evictedKeys: Number.isFinite(Number(fields.evicted_keys)) ? Number(fields.evicted_keys) : null,
    keyspaceHits: Number.isFinite(hits) ? hits : null,
    keyspaceMisses: Number.isFinite(misses) ? misses : null,
    keyspaceHitRatio: totalLookups > 0 ? hits / totalLookups : null,
  };
}

export async function refreshRedisServerStats({ force = false } = {}) {
  if (!process.env.REDIS_URL) return null;
  if (!force && cachedServerInfo && Date.now() - serverInfoUpdatedAt < SERVER_INFO_CACHE_TTL_MS) {
    return cachedServerInfo;
  }
  try {
    const redis = await getRedisClient();
    if (!redis || typeof redis.info !== 'function') return cachedServerInfo;
    const [memoryInfo, statsInfo] = await Promise.all([
      redisDeadline(() => redis.info('memory'), redis, { destroyOnTimeout: false, timeoutMs: 500 }),
      redisDeadline(() => redis.info('stats'), redis, { destroyOnTimeout: false, timeoutMs: 500 }),
    ]);
    cachedServerInfo = parseRedisInfo(`${memoryInfo || ''}\n${statsInfo || ''}`);
    serverInfoUpdatedAt = Date.now();
    return cachedServerInfo;
  } catch {
    return cachedServerInfo;
  }
}

export function getRedisCacheStats() {
  return {
    configured: Boolean(process.env.REDIS_URL),
    commandsQueueMaxLength: getRedisCommandsQueueMaxLength(),
    commandTimeoutMs: getCommandTimeoutMs(),
    consecutiveTimeoutThreshold: getConsecutiveTimeoutThreshold(),
    recommendedEvictionPolicy: 'allkeys-lru',
    cache: cacheSlot.stats(),
    rateLimit: rateLimitSlot.stats(),
    serverInfo: cachedServerInfo,
    serverInfoUpdatedAt: serverInfoUpdatedAt ? new Date(serverInfoUpdatedAt).toISOString() : null,
  };
}

let cachedNamespaceSource = null;
let cachedIsolatedNamespace = null;

export function redisKey(suffix) {
  const explicit = process.env.REDIS_NAMESPACE;
  if (explicit) return `${explicit}:v1:${suffix}`;
  const source = `${process.env.MONGODB_URI || ''}:${process.env.MONGODB_DB || 'quizDB'}`;
  if (source !== cachedNamespaceSource) {
    cachedNamespaceSource = source;
    cachedIsolatedNamespace = `meow:${createHash('sha256').update(source).digest('hex').slice(0, 16)}`;
  }
  return `${cachedIsolatedNamespace}:v1:${suffix}`;
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

async function storeCacheValue(key, value, ttlSeconds, format, maxBytes, { lease, encoded: preEncoded } = {}) {
  try {
    const redis = await getRedisClient();
    if (!redis) return false;
    const encoded = preEncoded && preEncoded.bytes <= maxBytes ? preEncoded : encodeCacheValue(value, format, maxBytes);
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
