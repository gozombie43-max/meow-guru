import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Collection } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

const state = vi.hoisted(() => ({ values: new Map(), publish: vi.fn() }));
vi.mock('../../config/redis.js', () => ({
  redisGetJson: vi.fn(async key => state.values.get(key) ?? null),
  redisSetJson: vi.fn(async (key, value) => { state.values.set(key, value); }),
  redisDelete: vi.fn(async (...keys) => { keys.forEach(key => state.values.delete(key)); }),
  getRedisClient: vi.fn(async () => ({ publish: state.publish })),
  redisKey: key => `test:${key}`,
  reportRedisFailure: vi.fn(),
}));

import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { assertSession, createSession, evictUserSessionCache, revokeSession } from '../sessions.js';
import { verifyToken } from '../jwt.js';
import { redisGetJson } from '../../config/redis.js';

let mongo, db;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'auth_redis_test');
  vi.stubEnv('REDIS_URL', 'redis://mocked');
  db = await connectMongoDB();
  await db.collection('users').insertOne({ id: 'learner', role: 'student' });
}, 60000);
afterAll(async () => { await disconnectMongoDB(); await mongo?.stop(); vi.unstubAllEnvs(); });

it('uses Redis after local expiry and evicts shared sessions on role change and logout', async () => {
  const decoded = verifyToken((await createSession({ id: 'learner' })).token);
  expect((await assertSession(decoded)).role).toBe('student');
  const redisReads = vi.mocked(redisGetJson).mock.calls.length;
  const later = performance.now() + 16_000;
  const clock = vi.spyOn(performance, 'now').mockReturnValue(later);
  await new Promise(resolve => setTimeout(resolve, 2));
  const find = vi.spyOn(Collection.prototype, 'findOne');
  expect((await assertSession(decoded)).role).toBe('student');
  expect(vi.mocked(redisGetJson).mock.calls.length).toBeGreaterThan(redisReads);
  expect(find).not.toHaveBeenCalled();
  find.mockRestore();
  clock.mockRestore();

  await db.collection('users').updateOne({ id: 'learner' }, { $set: { role: 'admin' } });
  await evictUserSessionCache('learner');
  expect((await assertSession(decoded)).role).toBe('admin');
  await revokeSession(decoded);
  await expect(assertSession(decoded)).rejects.toMatchObject({ statusCode: 401 });
  expect(state.publish).toHaveBeenCalled();
});
