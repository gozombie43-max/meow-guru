import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Collection } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';

const state = vi.hoisted(() => ({ values: new Map(), publish: vi.fn(), createClient: vi.fn() }));
vi.mock('redis', () => ({ createClient: state.createClient }));
vi.mock('../../config/redis.js', () => ({
  redisGetJson: vi.fn(async key => state.values.get(key) ?? null),
  redisSetJson: vi.fn(async (key, value) => { state.values.set(key, value); }),
  redisDelete: vi.fn(async (...keys) => { keys.forEach(key => state.values.delete(key)); }),
  getRedisClient: vi.fn(async () => ({ publish: state.publish })),
  redisKey: key => `test:${key}`,
  reportRedisFailure: vi.fn(),
}));

import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import {
  assertSession, closeSessionInvalidationSubscriber, createSession,
  evictUserSessionCache, revokeSession, startSessionInvalidationSubscriber,
} from '../sessions.js';
import { verifyToken } from '../jwt.js';
import { redisGetJson, reportRedisFailure } from '../../config/redis.js';

let mongo, db;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri());
  vi.stubEnv('MONGODB_DB', 'auth_redis_test');
  vi.stubEnv('REDIS_URL', 'redis://mocked');
  db = await connectMongoDB();
  await db.collection('users').insertOne({ id: 'learner', role: 'student' });
}, 60000);
afterAll(async () => {
  await closeSessionInvalidationSubscriber();
  await disconnectMongoDB();
  await mongo?.stop();
  vi.unstubAllEnvs();
});

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
  // Shared payloads still require durable revocation/current-role validation.
  expect(find).toHaveBeenCalledWith(expect.objectContaining({ _id: decoded.sid }), expect.any(Object));
  find.mockRestore();
  clock.mockRestore();

  await db.collection('users').updateOne({ id: 'learner' }, { $set: { role: 'admin' } });
  await evictUserSessionCache('learner');
  expect((await assertSession(decoded)).role).toBe('admin');
  await revokeSession(decoded);
  await expect(assertSession(decoded)).rejects.toMatchObject({ statusCode: 401 });
  expect(state.publish).toHaveBeenCalled();
});

it('receives cross-instance session invalidations and clears local entries on connection events', async () => {
  await db.collection('users').updateOne({ id: 'learner' }, { $set: { role: 'student' } });
  const handlers = new Map();
  let onMessage;
  const subscriber = {
    on: vi.fn((event, handler) => { handlers.set(event, handler); }),
    connect: vi.fn(async () => {}),
    subscribe: vi.fn(async (_channel, callback) => { onMessage = callback; }),
    destroy: vi.fn(),
  };
  state.createClient.mockReturnValue(subscriber);

  const decoded = verifyToken((await createSession({ id: 'learner' })).token);
  await assertSession(decoded);
  expect((await assertSession(decoded)).role).toBe('student');
  vi.stubEnv('REDIS_URL', '');
  await startSessionInvalidationSubscriber();
  expect(state.createClient).not.toHaveBeenCalled();
  vi.stubEnv('REDIS_URL', 'redis://mocked');
  await startSessionInvalidationSubscriber();
  expect(subscriber.subscribe).toHaveBeenCalledWith('test:auth-evictions', expect.any(Function));
  await startSessionInvalidationSubscriber();
  expect(state.createClient).toHaveBeenCalledTimes(1);

  await db.collection('users').updateOne({ id: 'learner' }, { $set: { role: 'editor' } });
  state.values.clear();
  onMessage(JSON.stringify({ sid: decoded.sid, userId: decoded.id }));
  expect((await assertSession(decoded)).role).toBe('editor');

  await db.collection('users').updateOne({ id: 'learner' }, { $set: { role: 'admin' } });
  state.values.clear();
  onMessage('{malformed');
  onMessage('{}');
  onMessage(JSON.stringify({ userId: decoded.id }));
  expect((await assertSession(decoded)).role).toBe('admin');

  await db.collection('users').updateOne({ id: 'learner' }, { $set: { role: 'student' } });
  state.values.clear();
  handlers.get('ready')();
  expect((await assertSession(decoded)).role).toBe('student');
  handlers.get('error')();

  state.publish.mockRejectedValueOnce(new Error('publish failed'));
  await evictUserSessionCache('learner');
  expect(reportRedisFailure).toHaveBeenCalled();

  vi.useFakeTimers();
  const retryClient = {
    ...subscriber,
    connect: vi.fn().mockRejectedValue(new Error('connection failed')),
    destroy: vi.fn(),
  };
  state.createClient.mockReturnValue(retryClient);
  handlers.get('end')();
  await vi.advanceTimersByTimeAsync(30_000);
  expect(retryClient.destroy).toHaveBeenCalled();
  await closeSessionInvalidationSubscriber();
  vi.useRealTimers();
  expect(subscriber.destroy).not.toHaveBeenCalled();
  await startSessionInvalidationSubscriber();
  expect(state.createClient).toHaveBeenCalledTimes(2);
});
