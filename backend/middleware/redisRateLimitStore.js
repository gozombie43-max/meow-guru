import { createHash } from 'node:crypto';
import { getRedisClient, redisKey, reportRedisFailure } from '../config/redis.js';
import { MongoRateLimitStore } from './mongoRateLimitStore.js';

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
    this.fallback = new MongoRateLimitStore(prefix);
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
    try {
      const redis = await getRedisClient();
      if (redis) {
        const [totalHits, remaining] = await redis.eval(INCREMENT, {
          keys: [this.key(key)], arguments: [String(this.windowMs)],
        });
        return { totalHits: Number(totalHits), resetTime: new Date(Date.now() + Number(remaining)) };
      }
    } catch {
      reportRedisFailure();
      // Preserve distributed abuse protection while Redis is unavailable.
    }
    return this.fallback.increment(key);
  }

  async decrement(key) {
    try {
      const redis = await getRedisClient();
      if (redis) return void await redis.eval(DECREMENT, { keys: [this.key(key)], arguments: [] });
    } catch { reportRedisFailure(); }
    await this.fallback.decrement(key);
  }

  async resetKey(key) {
    try {
      const redis = await getRedisClient();
      if (redis) await redis.del(this.key(key));
    } catch { reportRedisFailure(); }
    await this.fallback.resetKey(key);
  }
}
