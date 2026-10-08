import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Collection } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import { once } from 'node:events';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { clearSharedLocalCaches } from '../../infrastructure/tieredCache.js';
import progressRouter from '../progress.routes.js';
import { getTrainingDashboardData } from '../../services/training/application/getTrainingDashboard.js';
import { cachedTrainingDashboard } from '../../services/training/dashboardCache.js';
vi.mock('../../middleware/protect.js', () => ({ optionalAuth: (_req, _res, next) => next(), protect: (req, res, next) => {
  if (!req.headers.authorization) return res.sendStatus(401);
  req.user = { id: req.headers.authorization }; next();
} }));
let mongo, db, server, base;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri()); vi.stubEnv('MONGODB_DB', 'batch_d');
  db = await connectMongoDB();
  const app = express(); app.use(progressRouter); server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}, 60000);
beforeEach(async () => { clearSharedLocalCaches(); await db.collection('userTopicProgress').deleteMany({}); });
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await new Promise(resolve => server.close(resolve)); await disconnectMongoDB(); await mongo.stop(); vi.unstubAllEnvs(); });
it('loads private progress without a catalog lookup and enforces owner and response scope', async () => {
  await db.collection('userTopicProgress').insertMany([{ userId: 'one', topic: 'algebra', solvedCount: 4 }, { userId: 'two', topic: 'algebra', solvedCount: 8 }]);
  const original = Collection.prototype.find;
  vi.spyOn(Collection.prototype, 'find').mockImplementation(function (...args) {
    if (this.collectionName === 'questions') throw new Error('Private progress queried public catalog');
    return original.apply(this, args);
  });
  expect((await fetch(`${base}/topics/private`)).status).toBe(401);
  for (const [owner, count] of [['one', 4], ['two', 8]]) {
    const response = await fetch(`${base}/topics/private?subject=mathematics`, { headers: { authorization: owner } });
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const data = await response.json(); expect(data).not.toHaveProperty('totals');
    expect(data.userProgress.algebra.userSolved).toBe(count);
  }
  expect((await fetch(`${base}/topics/private?subject=bad`, { headers: { authorization: 'one' } })).status).toBe(400);
});
it('skips expiry scans on a warm dashboard and reconciles after its active deadline', async () => {
  const deadline = Date.now() + 1500;
  await cachedTrainingDashboard('deadline-owner', 'ssc-cgl', async () => ({ active: [{ id: 'visible', deadline: new Date(deadline).toISOString() }] }));
  const find = vi.spyOn(Collection.prototype, 'find');
  expect((await getTrainingDashboardData('deadline-owner', 'ssc-cgl')).active[0].id).toBe('visible');
  const expiryCalls = () => find.mock.calls.filter((call, index) => find.mock.instances[index].collectionName === 'trainingSessions' && call[0]?.deadline?.$lte);
  expect(expiryCalls()).toHaveLength(0);
  await new Promise(resolve => setTimeout(resolve, Math.max(1, deadline - Date.now() + 20)));
  expect((await getTrainingDashboardData('deadline-owner', 'ssc-cgl')).active).toEqual([]);
  expect(expiryCalls()).toHaveLength(1);
});
it('recovers expiry scans after the bounded cache TTL without an expiry worker', async () => {
  const find = vi.spyOn(Collection.prototype, 'find');
  await getTrainingDashboardData('ttl-owner', 'ssc-cgl');
  await getTrainingDashboardData('ttl-owner', 'ssc-cgl');
  const expiryCalls = () => find.mock.calls.filter((call, index) => find.mock.instances[index].collectionName === 'trainingSessions' && call[0]?.deadline?.$lte);
  expect(expiryCalls()).toHaveLength(1);
  await new Promise(resolve => setTimeout(resolve, 5100));
  await getTrainingDashboardData('ttl-owner', 'ssc-cgl');
  expect(expiryCalls()).toHaveLength(2);
}, 10000);
