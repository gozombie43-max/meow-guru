import { randomUUID } from 'node:crypto';
import { getRedisClient, redisKey, reportRedisFailure } from '../config/redis.js';
import { getMongoDB } from '../config/mongodb.js';
import { battleMatchmakingDegraded, battleMatchmakingLockAttempts } from '../infrastructure/metrics.js';
const LOCK_MS = 15_000;
const RELEASE = "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0";
export async function acquireMatchmakingPass() {
  const owner = randomUUID(), key = redisKey('battle:matchmaking-pass');
  let redis, degraded = false, ownsRedis = false;
  try {
    redis = await getRedisClient();
    degraded = !redis;
    if (redis) {
      ownsRedis = Boolean(await redis.set(key, owner, { NX: true, PX: LOCK_MS }));
      if (!ownsRedis) { battleMatchmakingDegraded.set(0); battleMatchmakingLockAttempts.inc({ outcome: 'busy' }); return { acquired: false, degraded: false, release: async () => {} }; }
    }
  } catch { reportRedisFailure(); degraded = true; }
  battleMatchmakingDegraded.set(degraded ? 1 : 0);
  const releaseRedis = async () => {
    if (ownsRedis) try { await redis.eval(RELEASE, { keys: [key], arguments: [owner] }); } catch { reportRedisFailure(); }
  };
  // Every mode shares this durable lease, including Redis-isolated instances.
  let locks, acquired = false;
  try {
    locks = getMongoDB().collection('battleMatchmakingLocks');
    const now = new Date();
    const result = await locks.findOneAndUpdate({ _id: 'pass', expiresAt: { $lte: now } },
      { $set: { owner, expiresAt: new Date(+now + LOCK_MS) } }, { upsert: true, returnDocument: 'after', timeoutMS: 2000 });
    acquired = result?.owner === owner;
  } catch (error) {
    if (error.code !== 11000) { await releaseRedis(); battleMatchmakingLockAttempts.inc({ outcome: 'error' }); throw error; }
  }
  battleMatchmakingLockAttempts.inc({ outcome: acquired ? degraded ? 'degraded' : 'acquired' : 'busy' });
  if (!acquired) { await releaseRedis(); return { acquired: false, degraded, release: async () => {} }; }
  return {
    acquired: true, degraded,
    renew: async () => {
      const now = new Date();
      const result = await locks.updateOne({ _id: 'pass', owner, expiresAt: { $gt: now } },
        { $set: { expiresAt: new Date(+now + LOCK_MS) } }, { timeoutMS: 2000 });
      return result.matchedCount === 1;
    },
    release: async () => { try { await locks.deleteOne({ _id: 'pass', owner }, { timeoutMS: 2000 }); } finally { await releaseRedis(); } },
  };
}
