import { createHash } from 'node:crypto';
import { getRedisClient, redisKey, reportRedisFailure } from '../config/redis.js';
import { LocalRateLimitStore } from './localRateLimitStore.js';

const INCREMENT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
local remaining = redis.call('PTTL', KEYS[1])
if remaining < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  remaining = tonumber(ARGV[1])
end
return {hits, remaining}`;

const DECREMENT = `
local hits = tonumber(redis.call('GET', KEYS[1]) or '0')
if hits > 0 then return redis.call('DECR', KEYS[1]) end
return 0`;

export class RedisRateLimitStore {
  localKeys = false;

  constructor(prefix) {
    this.prefix = prefix;
    this.fallback = new LocalRateLimitStore();
    const multiplier = Number(process.env.RATE_LIMIT_OUTAGE_MULTIPLIER ?? 0.5);
    this.outageMultiplier = Number.isFinite(multiplier) && multiplier > 0 && multiplier <= 1 ? multiplier : 0.5;
  }

  init(options) {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  key(key) {
    const digest = createHash('sha256').update(String(key)).digest('hex');
    return redisKey(`rate:${this.prefix}:${digest}`);
  }

  async increment(key) {
    const local = this.fallback.increment(key);
    try {
      const redis = await getRedisClient();
      if (redis) {
        const [totalHits, remaining] = await redis.eval(INCREMENT, {
          keys: [this.key(key)], arguments: [String(this.windowMs)],
        });
        const result = { totalHits: Number(totalHits), resetTime: new Date(Date.now() + Number(remaining)) };
        this.fallback.observe(key, result);
        return { ...result, totalHits: Math.max(result.totalHits, local.totalHits) };
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
