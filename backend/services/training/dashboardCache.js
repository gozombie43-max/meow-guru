import { createHash } from 'node:crypto';
import { getRedisClient, redisGetJson, redisKey, redisSetJson, reportRedisFailure } from '../../config/redis.js';

const owner = (userId, exam) => createHash('sha256').update(JSON.stringify([String(userId), exam])).digest('hex');
const epochKey = (userId, exam) => redisKey(`training-dashboard-epoch:${owner(userId, exam)}`);

export async function readTrainingDashboardCache(userId, exam) {
  try {
    const redis = await getRedisClient();
    if (!redis) return null;
    const epoch = await redis.get(epochKey(userId, exam));
    const key = `training-dashboard:${owner(userId, exam)}:${epoch || '0'}`;
    return { key, value: await redisGetJson(key) };
  } catch {
    reportRedisFailure();
    return null;
  }
}

export async function writeTrainingDashboardCache(key, value) {
  if (key) await redisSetJson(key, value, 5);
}

export async function invalidateTrainingDashboard(userId, exam) {
  try {
    const redis = await getRedisClient();
    if (!redis) return;
    await redis.eval("local value = redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 30); return value", {
      keys: [epochKey(userId, exam)], arguments: [],
    });
  } catch { reportRedisFailure(); }
}
