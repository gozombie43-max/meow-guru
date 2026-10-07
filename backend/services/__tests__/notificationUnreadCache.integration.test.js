import { randomUUID } from 'node:crypto';
import { Collection } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

const shared = vi.hoisted(() => ({ values: new Map(), online: true }));
vi.mock('../../config/redis.js', () => ({
  redisGetJson: vi.fn(async key => shared.online ? shared.values.get(key) ?? null : null),
  redisSetJson: vi.fn(async (key, value) => { if (shared.online) shared.values.set(key, value); }),
}));
// Deliberately drop every event: the second module must reconcile via Mongo.
vi.mock('../../infrastructure/cacheInvalidation.js', () => ({ onCacheInvalidation: vi.fn(), publishCacheInvalidation: vi.fn() }));
vi.mock('../notificationRealtime.js', () => ({ emitNotificationToUser: vi.fn(), emitGlobalNotification: vi.fn() }));

let mongo, db, firstMongo, secondMongo, first, second, notifications, user;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  vi.stubEnv('MONGODB_URI', mongo.getUri()); vi.stubEnv('MONGODB_DB', 'notification_revision_test');
  firstMongo = await import('../../config/mongodb.js'); db = await firstMongo.connectMongoDB();
  first = await import('../../repositories/notificationRepository.js');
  notifications = await import('../notificationCenterService.js');
  vi.resetModules();
  secondMongo = await import('../../config/mongodb.js'); await secondMongo.connectMongoDB();
  second = await import('../../repositories/notificationRepository.js');
}, 60000);
beforeEach(async () => {
  user = `learner-${randomUUID()}`; shared.values.clear(); shared.online = true;
  for (const name of ['notificationFeed', 'notificationReceipts', 'runtimeCacheRevisions', 'users']) await db.collection(name).deleteMany({});
  await db.collection('users').insertOne({ id: user });
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await firstMongo?.disconnectMongoDB(); await secondMongo?.disconnectMongoDB(); await mongo?.stop(); vi.unstubAllEnvs(); });
const unread = (repository, id = user) => repository.getInboxUnreadCount(id);
const create = () => notifications.createUserNotification({ userId: user, title: 'New quiz', body: 'Ready' });

it('ignores surviving local/shared counts after offline mutations with no Pub/Sub delivery', async () => {
  expect(await unread(first)).toBe(0); expect(await unread(second)).toBe(0);
  shared.online = false;
  const id = await create();
  expect(await unread(second)).toBe(1);
  shared.online = true;
  expect(await unread(second)).toBe(1);
  shared.online = false;
  await first.upsertReadReceipt(user, id);
  shared.online = true;
  expect(await unread(second)).toBe(0);
  await create(); expect(await unread(second)).toBe(1);
  await first.setAllReadForUser(user, new Date(Date.now() + 1000));
  expect(await unread(second)).toBe(0);
});

it('separates global notifications, user scopes, and an owner literally named all', async () => {
  expect(await unread(second, 'all')).toBe(0);
  await notifications.createGlobalNotification({ title: 'Global', body: 'Everyone' });
  expect(await unread(second, 'all')).toBe(1); expect(await unread(second)).toBe(1);
  await create();
  expect(await unread(second, 'all')).toBe(1); expect(await unread(second)).toBe(2);
  const scopes = (await db.collection('runtimeCacheRevisions').find({}).toArray()).map(row => row._id);
  expect(scopes).toContain('notification:v2:global');
  expect(scopes.filter(value => value.startsWith('notification:v2:user:'))).toHaveLength(1);
});

it('coalesces cold counts and expires them when the first notification expires', async () => {
  const expiry = new Date(Date.now() + 300);
  await db.collection('notificationFeed').insertMany([
    { audience: 'user', userId: user, createdAt: new Date(), expiresAt: expiry },
    { audience: 'user', userId: user, createdAt: new Date() },
  ]);
  const aggregate = vi.spyOn(Collection.prototype, 'aggregate');
  expect(await Promise.all(Array.from({ length: 100 }, () => unread(second)))).toEqual(Array(100).fill(2));
  expect(aggregate).toHaveBeenCalledTimes(1);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, expiry.getTime() - Date.now()) + 25));
  expect(await unread(second)).toBe(1);
});

it.each(['insert', 'receipt', 'read-all'])('rolls back the %s mutation when its revision cannot commit', async kind => {
  const id = await db.collection('notificationFeed').insertOne({ audience: 'user', userId: user, createdAt: new Date() });
  const original = Collection.prototype.updateOne;
  vi.spyOn(Collection.prototype, 'updateOne').mockImplementation(function (...args) {
    if (this.collectionName === 'runtimeCacheRevisions') throw new Error('Revision failure');
    return original.apply(this, args);
  });
  const mutation = kind === 'insert' ? create : kind === 'receipt'
    ? () => first.upsertReadReceipt(user, id.insertedId) : () => first.setAllReadForUser(user, new Date());
  await expect(mutation()).rejects.toThrow('Revision failure');
  expect(await db.collection('notificationFeed').countDocuments()).toBe(1);
  expect(await db.collection('notificationReceipts').countDocuments()).toBe(0);
  expect((await db.collection('users').findOne({ id: user })).notificationState).toBeUndefined();
  expect(await db.collection('runtimeCacheRevisions').countDocuments()).toBe(0);
});
