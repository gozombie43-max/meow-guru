import { createHash } from 'node:crypto';
import { getRedisClient, redisKey, reportRedisFailure } from '../config/redis.js';
import { LocalRateLimitStore } from './localRateLimitStore.js';

const INCREMENT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local resetAt = (math.floor(now / tonumber(ARGV[1])) + 1) * tonumber(ARGV[1])
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIREAT', KEYS[1], resetAt) end
return {hits, resetAt - now, resetAt}`;

const DECREMENT = `
local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
if hits > 0 then return redis.call('DECR', KEYS[1]) end
return 0`;

export class RedisRateLimitStore {
  localKeys = false;

  constructor(prefix, { outagePolicy = 'conservative', maxKeys = 10000 } = {}) {
    this.prefix = prefix;
    this.fallback = new LocalRateLimitStore({ maxKeys });
    this.blocked = new Map();
    this.maxKeys = maxKeys;
    this.limit = Infinity;
    this.canDecrement = false;
    const multiplier = Number(process.env.RATE_LIMIT_OUTAGE_MULTIPLIER ?? 0.5);
    const conservative = Number.isFinite(multiplier) && multiplier > 0 && multiplier <= 1 ? multiplier : 0.5;
    this.outageMultiplier = outagePolicy === 'availability' ? 1 : conservative;
    this.outagePolicy = outagePolicy;
  }

  init(options) {
    this.windowMs = options.windowMs;
    const rawLimit = options.limit ?? options.max;
    this.limit = typeof rawLimit === 'number' && Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : Infinity;
    this.canDecrement = Boolean(options.skipFailedRequests || options.skipSuccessfulRequests);
    this.fallback.init(options);
  }

  key(key) {
    const digest = createHash('sha256').update(String(key)).digest('hex');
    return redisKey(`rate:v2:${this.prefix}:${digest}`);
  }

  rememberBlocked(key, entry, now) {
    if (!this.blocked.has(key) && this.blocked.size >= this.maxKeys) {
      for (const [id, row] of this.blocked) if (row.resetAt <= now) this.blocked.delete(id);
    }
    if (this.blocked.has(key) || this.blocked.size < this.maxKeys) this.blocked.set(key, entry);
  }

  async increment(key) {
    const now = Date.now();
    let blockedEntry = this.blocked.get(key);
    if (blockedEntry && blockedEntry.resetAt <= now) {
      this.blocked.delete(key);
      blockedEntry = undefined;
    }
    if (blockedEntry && now < blockedEntry.resetAt) {
      blockedEntry.hits = Math.max(this.limit + 1, blockedEntry.hits + 1);
      const result = { totalHits: blockedEntry.hits, resetTime: new Date(blockedEntry.sharedResetAt) };
      this.fallback.increment(key);
      this.fallback.observe(key, result);
      return result;
    }

    const local = this.fallback.increment(key);
    try {
      const redis = await getRedisClient();
      if (redis) {
        const [rawHits, rawRemaining, rawResetAt] = await redis.eval(INCREMENT, {
          keys: [this.key(key)], arguments: [String(this.windowMs)],
        });
        const totalHits = Number(rawHits);
        const sharedResetAt = Number(rawResetAt);
        const result = { totalHits, resetTime: new Date(sharedResetAt) };
        this.fallback.observe(key, result);
        const currentNow = Date.now();
        const parsedRemaining = Number(rawRemaining);
        const remainingMs = Number.isFinite(parsedRemaining)
          ? Math.max(0, Math.min(parsedRemaining, this.windowMs))
          : Math.max(0, Math.min(sharedResetAt - currentNow, this.windowMs));
        const shouldBlockLocally = this.canDecrement ? totalHits > this.limit : totalHits >= this.limit;
        if (remainingMs > 0 && shouldBlockLocally) {
          this.rememberBlocked(key, {
            hits: totalHits,
            resetAt: currentNow + remainingMs,
            sharedResetAt,
          }, currentNow);
        }
        // A successful shared counter is authoritative, including after rollover
        // or recovery. Never carry a previous local window into this decision.
        return result;
      }
    } catch {
      reportRedisFailure();
      // Protect the API without moving outage traffic into MongoDB.
    }
    return { ...local, totalHits: Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(local.totalHits / this.outageMultiplier)) };
  }

  async decrement(key) {
    this.blocked.delete(key);
    this.fallback.decrement(key);
    try {
      const redis = await getRedisClient();
      if (redis) return void await redis.eval(DECREMENT, { keys: [this.key(key)], arguments: [] });
    } catch { reportRedisFailure(); }
  }

  async resetKey(key) {
    this.blocked.delete(key);
    try {
      const redis = await getRedisClient();
      if (redis) await redis.del(this.key(key));
    } catch { reportRedisFailure(); }
    await this.fallback.resetKey(key);
  }
}
