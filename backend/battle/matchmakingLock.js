import { randomUUID } from 'node:crypto';
import { getRedisClient, redisKey, reportRedisFailure } from '../config/redis.js';

const LOCK_MS = 5000;
const RELEASE = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";

export async function acquireMatchmakingPass() {
  try {
    const redis = await getRedisClient();
    if (!redis) return { acquired: true, release: async () => {} };
    const key = redisKey('battle:matchmaking-pass');
    const owner = randomUUID();
    const acquired = await redis.set(key, owner, { NX: true, PX: LOCK_MS });
    if (!acquired) return { acquired: false, release: async () => {} };
    return {
      acquired: true,
      release: async () => {
        try { await redis.eval(RELEASE, { keys: [key], arguments: [owner] }); }
        catch { reportRedisFailure(); }
      },
    };
  } catch {
    reportRedisFailure();
    return { acquired: true, release: async () => {} };
  }
}
