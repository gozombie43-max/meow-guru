import { createHash } from 'node:crypto';
import { getRedisClient, redisGetJson, redisKey, redisSetJson, reportRedisFailure } from '../../config/redis.js';

const owner = userId => createHash('sha256').update(String(userId)).digest('hex');
const epochKey = userId => redisKey(`topic-progress-epoch:${owner(userId)}`);

export async function readTopicProgressCache(userId) {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const epoch = await redis.get(epochKey(userId));
    const key = `topic-progress:${owner(userId)}:${epoch || '0'}`;
    return { key, value: await redisGetJson(key) };
  } catch { reportRedisFailure(); return null; }
}

export async function writeTopicProgressCache(key, value) {
  if (key) await redisSetJson(key, value, 10);
}

export async function invalidateTopicProgress(userId) {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.eval("local value = redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 30); return value", {
      keys: [epochKey(userId)], arguments: [],
    });
  } catch { reportRedisFailure(); }
}
