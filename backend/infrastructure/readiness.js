import { getMongoDB } from '../config/mongodb.js';
import { getRedisClient, redisHealth } from '../config/redis.js';
import { assertMigrations } from '../migrations/runner.js';

export async function checkReadiness() {
  const db = getMongoDB();
  await db.command({ ping: 1 }, { timeoutMS: 2000 });
  await assertMigrations(db);

  if (process.env.REQUIRE_REDIS_FOR_READINESS === 'true') {
    const redis = await getRedisClient();
    if (!redis || redisHealth() !== 'healthy') {
      throw new Error('Redis is required for readiness but is unavailable');
    }
  }
}
