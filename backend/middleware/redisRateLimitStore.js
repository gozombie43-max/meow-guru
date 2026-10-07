import { createHash } from 'node:crypto';
import { getRedisClient, redisKey, reportRedisFailure } from '../config/redis.js';
import { LocalRateLimitStore } from './localRateLimitStore.js';

const INCREMENT = `
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local resetAt = (math.floor(now / tonumber(ARGV[1])) + 1) * tonumber(ARGV[1])
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIREAT', KEYS[1], resetAt) end
local remaining = redis.call('PTTL', KEYS[1])
if remaining < 0 then
  redis.call('PEXPIREAT', KEYS[1], resetAt)
  remaining = resetAt - now
end
return {hits, remaining, resetAt}`;

const DECREMENT = `
local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
if hits > 0 then return redis.call('DECR', KEYS[1]) end
return 0`;

export class RedisRateLimitStore {
  localKeys = false;

  constructor(prefix, { outagePolicy = 'conservative' } = {}) {
    this.prefix = prefix;
    this.fallback = new LocalRateLimitStore();
    const multiplier = Number(process.env.RATE_LIMIT_OUTAGE_MULTIPLIER ?? 0.5);
    const conservative = Number.isFinite(multiplier) && multiplier > 0 && multiplier <= 1 ? multiplier : 0.5;
    this.outageMultiplier = outagePolicy === 'availability' ? 1 : conservative;
    this.outagePolicy = outagePolicy;
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  key(key) {
    const digest = createHash('sha256').update(String(key)).digest('hex');
    return redisKey(`rate:v2:${this.prefix}:${digest}`);
  }

  async increment(key) {
    const local = this.fallback.increment(key);
    try {
      const redis = await getRedisClient();
      if (redis) {
        const [totalHits, , resetAt] = await redis.eval(INCREMENT, {
          keys: [this.key(key)], arguments: [String(this.windowMs)],
        });
        const result = { totalHits: Number(totalHits), resetTime: new Date(Number(resetAt)) };
        this.fallback.observe(key, result);
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
    this.fallback.decrement(key);
    try {
      const redis = await getRedisClient();
      if (redis) return void await redis.eval(DECREMENT, { keys: [this.key(key)], arguments: [] });
    } catch { reportRedisFailure(); }
  }

  async resetKey(key) {
    try {
      const redis = await getRedisClient();
      if (redis) await redis.del(this.key(key));
    } catch { reportRedisFailure(); }
    await this.fallback.resetKey(key);
  }
}
