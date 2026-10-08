import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Collection } from 'mongodb';
import express from 'express';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import questionsRouter from '../questionRoutes.js';
import { enqueueConceptGrouping } from '../../repositories/conceptGroupRepository.js';
import { fetchSlotsForExam } from '../../services/mock/mockSlotService.js';
import { MOCK_TEST_SLOTS } from '../../config/exam-config.js';
import { up as initializeSlots, id as migrationId } from '../../migrations/018-default-mock-slots.js';
import { clearSharedLocalCaches } from '../../infrastructure/tieredCache.js';
import { initializePublicCatalogs, refreshPublicCatalogs } from '../../services/questions/topicCountSnapshot.js';
import { mutateQuestionBank } from '../../repositories/questionBankMutation.js';
import { assertSession } from '../../auth/sessions.js';
import { requestLogging, logger } from '../../infrastructure/logger.js';
import { registry } from '../../infrastructure/metrics.js';

let mongo, db, server, base;
const fingerprint = 'a'.repeat(64);
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri()); vi.stubEnv('MONGODB_DB', 'remaining_request_flows'); vi.stubEnv('REDIS_URL', '');
  db = await connectMongoDB();
  const app = express(); app.use(requestLogging); app.use('/api/questions', questionsRouter);
  app.get('/auth-probe', async (_req, res) => {
    try { await assertSession({ sid: 'probe-session', id: 'probe-user' }); res.json({ ok: true }); }
    catch { res.sendStatus(401); }
  });
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
}, 60000);
beforeEach(async () => {
  clearSharedLocalCaches();
  for (const name of ['questions', 'questionMetadata', 'conceptGroupMetadata', 'mockSlots', 'schemaMigrations', 'authSessions', 'users']) await db.collection(name).deleteMany({});
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await new Promise(resolve => server.close(resolve)); await disconnectMongoDB(); await mongo.stop(); vi.unstubAllEnvs(); });

it('polls one projected grouping record without metadata reads or writes, then caches immutable completion', async () => {
  await enqueueConceptGrouping(fingerprint, { status: 'queued', params: { private: 'not returned' }, attempts: 7, trace: { secret: 'not returned' } });
  const writes = vi.spyOn(Collection.prototype, 'updateOne'), reads = vi.spyOn(Collection.prototype, 'findOne');
  const aggregates = vi.spyOn(Collection.prototype, 'aggregate');
  let response = await fetch(`${base}/api/questions/concept-groups/${fingerprint}`);
  expect(await response.json()).toEqual({ groupingFingerprint: fingerprint, groupingStatus: 'processing' });
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(reads).toHaveBeenCalledTimes(1); expect(reads.mock.calls[0][1].projection).toEqual({ status: 1, 'result.groups': 1 });
  expect(writes).not.toHaveBeenCalled(); expect(aggregates).not.toHaveBeenCalled();
  const groups = [{ id: 'group', label: 'Equations', description: 'Linear equations', concepts: ['addition'] }];
  await db.collection('conceptGroupMetadata').updateOne({ _id: fingerprint }, { $set: { status: 'completed', result: { groups } } });
  reads.mockClear(); writes.mockClear();
  for (let i = 0; i < 2; i++) {
    response = await fetch(`${base}/api/questions/concept-groups/${fingerprint}`);
    expect(await response.json()).toEqual({ groupingFingerprint: fingerprint, groupingStatus: 'ready', conceptGroups: groups });
  }
  expect(reads).toHaveBeenCalledTimes(1); expect(writes).not.toHaveBeenCalled();
});
it('rejects malformed fingerprints before Mongo and does not initialize missing jobs', async () => {
  const read = vi.spyOn(Collection.prototype, 'findOne'), write = vi.spyOn(Collection.prototype, 'updateOne');
  expect((await fetch(`${base}/api/questions/concept-groups/invalid`)).status).toBe(400);
  expect(read).not.toHaveBeenCalled();
  expect((await fetch(`${base}/api/questions/concept-groups/${fingerprint}`)).status).toBe(404);
  expect(write).not.toHaveBeenCalled();
});
it('keeps empty slot catalogs read-only and initializes defaults without overwriting published papers', async () => {
  const slot = MOCK_TEST_SLOTS[0], write = vi.spyOn(Collection.prototype, 'updateOne');
  expect((await fetchSlotsForExam(slot.examSlug)).length).toBeGreaterThan(0);
  expect(write).not.toHaveBeenCalled(); expect(await db.collection('mockSlots').countDocuments({})).toBe(0);
  await db.collection('mockSlots').insertOne({ ...slot, title: 'Published custom paper', fixedQuestions: [{ question: 'Keep me' }] });
  await initializeSlots(db); await initializeSlots(db);
  expect(await db.collection('mockSlots').countDocuments({})).toBe(MOCK_TEST_SLOTS.length);
  expect((await db.collection('mockSlots').findOne({ id: slot.id })).title).toBe('Published custom paper');
  await db.collection('schemaMigrations').insertOne({ _id: migrationId, completedAt: new Date() });
  await db.collection('mockSlots').deleteOne({ id: slot.id }); await initializeSlots(db);
  expect(await db.collection('mockSlots').findOne({ id: slot.id })).toBeNull();
});
it('persists all public subjects before readiness and repairs missing durable records despite warm cache hits', async () => {
  expect(await initializePublicCatalogs()).toHaveLength(4);
  expect(await db.collection('questionMetadata').countDocuments({ kind: 'topic-counts' })).toBe(4);
  await db.collection('questionMetadata').deleteMany({ kind: 'topic-counts' });
  await initializePublicCatalogs();
  expect(await db.collection('questionMetadata').countDocuments({ kind: 'topic-counts' })).toBe(4);
  const aggregate = vi.spyOn(Collection.prototype, 'aggregate');
  clearSharedLocalCaches(); await initializePublicCatalogs();
  expect(aggregate).not.toHaveBeenCalled();
});
it('refreshes catalogs for external bank mutations and retains usable prior snapshots if a rebuild fails', async () => {
  await initializePublicCatalogs();
  await mutateQuestionBank(db, () => db.collection('questions').insertOne({ id: 'word', subject: 'english', topic: 'tenses', quizName: 'PYQ' }));
  clearSharedLocalCaches(); await refreshPublicCatalogs();
  const saved = await db.collection('questionMetadata').findOne({ _id: 'topic-counts:v2:english:false' });
  expect(saved.data.totals.tenses).toBe(1);
  await db.collection('questionMetadata').updateMany({ kind: 'topic-counts' }, { $set: { 'data.generatedAt': new Date(Date.now() - 2 * 3600000).toISOString() } });
  clearSharedLocalCaches();
  const aggregate = vi.spyOn(Collection.prototype, 'aggregate').mockImplementation(() => { throw new Error('Unavailable query'); });
  await initializePublicCatalogs(); expect(aggregate).not.toHaveBeenCalled();
  await expect(initializePublicCatalogs({ fresh: true })).rejects.toThrow('Unavailable query');
  aggregate.mockRestore();
  expect(await db.collection('questionMetadata').countDocuments({ kind: 'topic-counts' })).toBe(4);
});
it('attributes four cold and two warm physical authorization commands to request IDs without secret labels', async () => {
  await db.collection('users').insertOne({ id: 'probe-user', role: 'student' });
  await db.collection('authSessions').insertOne({ _id: 'probe-session', userId: 'probe-user', expiresAt: new Date(Date.now() + 60000) });
  const info = vi.spyOn(logger, 'info').mockImplementation(() => {});
  for (const requestId of ['cold-probe', 'warm-probe']) {
    const response = await fetch(`${base}/auth-probe`, { headers: { 'X-Request-ID': requestId } });
    expect(response.status).toBe(200); expect(response.headers.get('x-request-id')).toBe(requestId);
  }
  const rows = info.mock.calls.filter(call => call[1] === 'request completed').map(call => call[0]);
  expect(rows.map(row => row.mongo.total)).toEqual([4, 2]);
  expect(rows[1].mongo.operations).toEqual({ 'authorization:authSessions:find': 1, 'authorization:users:find': 1 });
  const metrics = await registry.metrics();
  expect(metrics).toContain('purpose="authorization"'); expect(metrics).toContain('cache="local"');
  expect(metrics).not.toContain('probe-session'); expect(metrics).not.toContain('probe-user');
});
