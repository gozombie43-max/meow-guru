import { beforeAll, afterAll, beforeEach, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import { once } from 'node:events';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createSession } from '../../auth/sessions.js';
import { chatJSON } from '../../ai/azureClient.js';
import router from '../cognitiveMapperRouter.js';
import { clearSharedLocalCaches } from '../../infrastructure/tieredCache.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { acquireAiLease } from '../../middleware/aiAdmission.js';
vi.mock('../../ai/azureClient.js', () => ({ chatJSON: vi.fn().mockRejectedValue(new Error('AI unavailable')) }));
let mongo, db, server, base, token;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create(); process.env.MONGODB_URI = mongo.getUri(); process.env.MONGODB_DB = 'cognitive_tests';
  db = await connectMongoDB();
  const app = express(); app.use(express.json()); app.use('/api/agent', router); app.use(errorHandler);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening'); base = `http://127.0.0.1:${server.address().port}`;
}, 60000);
beforeEach(async () => {
  clearSharedLocalCaches(); vi.clearAllMocks(); chatJSON.mockRejectedValue(new Error('AI unavailable'));
  await db.collection('users').deleteMany({}); await db.collection('idempotencyRecords').deleteMany({});
  await db.collection('aiLeases').deleteMany({});
  await db.collection('users').insertOne({ id: 'student', status: 'active', failureMap: {}, recentQuizzes: [] });
  token = (await createSession({ id: 'student' })).token;
});
afterAll(async () => { await new Promise(resolve => server.close(resolve)); await disconnectMongoDB(); await mongo.stop(); });
const post = (path, body, key) => fetch(`${base}/api/agent/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) }, body: JSON.stringify(body) });
const payload = { userId: 'student', questionId: 'q1', topic: 'Algebra', concept: 'Equations', timeSpent: 3 };
it('rejects anonymous and wrong-user access before database or AI processing', async () => {
  expect((await fetch(`${base}/api/agent/brain-scan/student`)).status).toBe(401);
  expect((await fetch(`${base}/api/agent/brain-scan/other`, { headers: { Authorization: `Bearer ${token}` } })).status).toBe(403);
  expect((await post('tag-failure', { ...payload, userId: 'other' })).status).toBe(403);
  expect(chatJSON).not.toHaveBeenCalled();
});
it('validates missing fields, unsafe concept keys and oversized batches', async () => {
  for (const body of [{ userId: 'student' }, { ...payload, concept: '$set' }, { ...payload, timeSpent: -1 }]) expect((await post('tag-failure', body)).status).toBe(400);
  expect((await post('tag-quiz-results', { userId: 'student', wrongAnswers: Array(101).fill(payload) })).status).toBe(400);
  expect(chatJSON).not.toHaveBeenCalled();
});
it('persists a failure once when a request is retried with the same key', async () => {
  const first = await post('tag-failure', payload, 'cognitive-retry-123'); expect(first.status).toBe(200);
  const repeated = await post('tag-failure', payload, 'cognitive-retry-123'); expect(repeated.status).toBe(200);
  expect(await repeated.json()).toEqual(await first.json());
  const profile = await db.collection('users').findOne({ id: 'student' }); expect(profile.failureMap['Algebra::Equations'].totalWrong).toBe(1);
  expect((await post('tag-failure', { ...payload, concept: 'Other' }, 'cognitive-retry-123')).status).toBe(409);
});
it('coalesces brain scans and invalidates the cached result after new evidence', async () => {
  await post('tag-failure', payload);
  const scan = () => fetch(`${base}/api/agent/brain-scan/student`, { headers: { Authorization: `Bearer ${token}` } });
  const responses = await Promise.all([scan(), scan()]); const rows = await Promise.all(responses.map(res => res.json()));
  expect(rows[0].totalConceptsTracked).toBe(1); expect(rows[1].totalConceptsTracked).toBe(1);
  expect((await (await scan()).json()).cached).toBe(true);
  await post('tag-failure', { ...payload, concept: 'Fractions' });
  const updated = await (await scan()).json(); expect(updated.totalConceptsTracked).toBe(2); expect(updated.cached).toBe(false);
});
it('keeps both updates when failures for the same concept arrive concurrently', async () => {
  const responses = await Promise.all([post('tag-failure', payload), post('tag-failure', { ...payload, questionId: 'q2' })]);
  expect(responses.map(response => response.status)).toEqual([200, 200]);
  const profile = await db.collection('users').findOne({ id: 'student' });
  expect(profile.failureMap['Algebra::Equations'].totalWrong).toBe(2);
});
it('rejects classification when both distributed admission slots are occupied', async () => {
  const releases = await Promise.all([acquireAiLease('student'), acquireAiLease('student')]);
  try { expect((await post('tag-failure', payload)).status).toBe(429); expect(chatJSON).not.toHaveBeenCalled(); }
  finally { await Promise.all(releases.map(release => release())); }
});
it('preserves successful rule tags and reports failures in a mixed batch', async () => {
  chatJSON.mockRejectedValueOnce(new Error('Dependency deadline exceeded')).mockResolvedValueOnce({ invalid: true });
  const response = await post('tag-quiz-results', { userId: 'student', wrongAnswers: [
    { ...payload, questionId: 'q1', timeSpent: 20 }, { ...payload, questionId: 'q2', timeSpent: 20 }, { ...payload, questionId: 'q3' },
  ] });
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.tagged).toHaveLength(1); expect(body.failedAnswers).toHaveLength(2);
});
it('returns an error when Mongo fails without exposing its message', async () => {
  const collection = db.collection('users');
  // Authentication succeeds before the repository read is forced to fail.
  const { Collection } = await import('mongodb');
  const original = Collection.prototype.findOne;
  const read = vi.spyOn(Collection.prototype, 'findOne').mockImplementation(function (...args) {
    if (this.collectionName === collection.collectionName && (!args[1]?.projection || args[1]?.projection?.failureMap)) throw new Error('private database details');
    return original.apply(this, args);
  });
  try { const response = await post('tag-failure', payload); expect(response.status).toBe(500); expect(await response.text()).not.toContain('private database details'); }
  finally { read.mockRestore(); }
});
