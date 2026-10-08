import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Collection, FindCursor } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import { once } from 'node:events';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { clearSharedLocalCaches } from '../../infrastructure/tieredCache.js';
import { fetchQuestionsSession } from '../../services/questions/questionSessionService.js';
import { trainingDashboardData } from '../../repositories/trainingRepository.js';
import { buildPaper } from '../../services/mock/mockPaperService.js';
import progressRouter from '../progress.routes.js';

vi.mock('../../middleware/protect.js', () => ({ optionalAuth: (req, _res, next) => { req.user = { id: 'owner' }; next(); }, protect: (req, _res, next) => { req.user = { id: 'owner' }; next(); } }));
let mongo, db, server, base;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri()); vi.stubEnv('MONGODB_DB', 'batch_c');
  db = await connectMongoDB();
  const app = express(); app.use(progressRouter);
  server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}, 60000);
beforeEach(async () => {
  clearSharedLocalCaches();
  for (const name of ['questions', 'questionMetadata', 'trainingSessions', 'trainingLearnerStateMeta', 'userTopicProgress'])
    await db.collection(name).deleteMany({});
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await new Promise(resolve => server.close(resolve)); await disconnectMongoDB(); await mongo.stop(); vi.unstubAllEnvs(); });
const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };

it('counts a filtered session before its page resolves and leaves totals absent when not requested', async () => {
  await db.collection('questions').insertOne({ id: 'q1', topic: 'algebra', exam: 'SSC CGL', question: '2+2?', options: ['4'], correctAnswer: 0 });
  const gate = deferred(), original = Collection.prototype.find;
  vi.spyOn(Collection.prototype, 'find').mockImplementation(function (...args) {
    const cursor = original.apply(this, args);
    if (this.collectionName === 'questions') {
      const read = cursor.toArray.bind(cursor);
      cursor.toArray = async () => { await gate.promise; return read(); };
    }
    return cursor;
  });
  const count = vi.spyOn(Collection.prototype, 'countDocuments');
  const work = fetchQuestionsSession({ topic: 'algebra', exam: 'SSC CGL', includeTotal: true });
  try { await vi.waitFor(() => expect(count).toHaveBeenCalledTimes(1)); }
  finally { gate.release(); }
  const result = await work;
  expect(result.totalCount).toBe(1); expect(result.questions).toHaveLength(1);
  count.mockClear();
  expect((await fetchQuestionsSession({ topic: 'algebra', exam: 'SSC CGL', includeTotal: false })).totalCount).toBeUndefined();
  expect(count).not.toHaveBeenCalled();
});

it.each([true, false])('starts dashboard history before catalog resolves, with readiness-selected projection (ready=%s)', async ready => {
  await db.collection('trainingLearnerStateMeta').insertOne({ _id: 'owner:ssc-cgl', version: 1, status: ready ? 'ready' : 'building' });
  const gate = deferred(), original = Collection.prototype.aggregate;
  vi.spyOn(Collection.prototype, 'aggregate').mockImplementation(function (...args) {
    const cursor = original.apply(this, args);
    if (this.collectionName === 'questions') {
      const read = cursor.toArray.bind(cursor);
      cursor.toArray = async () => { await gate.promise; return read(); };
    }
    return cursor;
  });
  const find = vi.spyOn(Collection.prototype, 'find');
  const meta = vi.spyOn(Collection.prototype, 'findOne');
  const project = vi.spyOn(FindCursor.prototype, 'project');
  const work = trainingDashboardData('owner', 'ssc-cgl', { includeHistory: true, compactHistory: true });
  let history;
  try {
    await vi.waitFor(() => {
      history = find.mock.results.find((_, index) => find.mock.instances[index].collectionName === 'trainingSessions'
        && find.mock.calls[index][0].status === 'completed');
      expect(history).toBeDefined();
    });
    const projection = project.mock.calls[project.mock.instances.indexOf(history.value)][0];
    expect(projection.questions !== undefined).toBe(ready);
    expect(meta.mock.instances.filter(instance => instance.collectionName === 'trainingLearnerStateMeta')).toHaveLength(1);
  } finally { gate.release(); await work; }
});

it('builds dynamic paper sections in batches of three and retains configured order and key precedence', async () => {
  const gates = []; let active = 0, peak = 0;
  vi.spyOn(Collection.prototype, 'find').mockImplementation(function () {
    if (this.collectionName !== 'questions') throw new Error('Unexpected slot or metadata lookup');
    const index = gates.length, gate = deferred(); gates.push(gate);
    return { limit() { return this; }, async toArray() {
      active++; peak = Math.max(peak, active); await gate.promise; active--;
      return [{ id: 'shared', question: 'Question', options: ['A', 'B'], correctAnswer: index % 2 }];
    } };
  });
  const work = buildPaper({ examSlug: 'ssc-cgl', testId: 'dynamic', slot: { configKey: 'ssc-cgl-tier1' } });
  try {
    await vi.waitFor(() => expect(gates).toHaveLength(3));
    gates[2].release(); gates[0].release(); gates[1].release();
    await vi.waitFor(() => expect(gates).toHaveLength(4));
    gates[3].release();
    const result = await work;
    expect(peak).toBe(3);
    expect(result.clientPaper.sections.map(section => section.key)).toEqual(['ga', 'reasoning', 'quant', 'english']);
    expect(result.answerKey.shared).toBe(1);
    expect(result.clientPaper.sections.every(section => section.questions[0].correctAnswer === undefined)).toBe(true);
  } finally { gates.forEach(gate => gate.release()); await work; }
});

it('starts private progress reads while a cold shared snapshot is still building', async () => {
  await db.collection('userTopicProgress').insertOne({ userId: 'owner', topic: 'algebra', solvedCount: 3 });
  const gate = deferred(), original = Collection.prototype.aggregate;
  vi.spyOn(Collection.prototype, 'aggregate').mockImplementation(function (...args) {
    const cursor = original.apply(this, args);
    if (this.collectionName === 'questions') {
      const read = cursor.toArray.bind(cursor);
      cursor.toArray = async () => { await gate.promise; return read(); };
    }
    return cursor;
  });
  const find = vi.spyOn(Collection.prototype, 'find');
  const work = fetch(`${base}/topics?subject=mathematics`);
  try { await vi.waitFor(() => expect(find.mock.instances.some(instance => instance.collectionName === 'userTopicProgress')).toBe(true)); }
  finally { gate.release(); }
  const response = await work;
  expect(response.status).toBe(200);
  expect((await response.json()).userProgress.algebra.userSolved).toBe(3);
});
