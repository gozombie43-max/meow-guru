import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Collection } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { recordQuestionAnswer } from './questionProgressRepository.js';
import { createTrainingSession, commitTrainingTransition, saveTrainingDiagnosis, saveTrainingMistakes } from './trainingRepository.js';
import { submitAttemptUpdate } from './mockTestRepository.js';
import { readTopicProgressCache, writeTopicProgressCache } from '../services/questions/topicProgressCache.js';
import { readTrainingDashboardCache, writeTrainingDashboardCache } from '../services/training/dashboardCache.js';

const shared = vi.hoisted(() => new Map());
vi.mock('../config/redis.js', () => ({
  getRedisClient: vi.fn(async () => null), redisKey: key => key, reportRedisFailure: vi.fn(),
  redisGetJson: vi.fn(async key => shared.get(key) ?? null),
  redisSetJson: vi.fn(async (key, value) => { shared.set(key, value); }),
}));
let mongo, db;
const fixture = () => ({ id: 'training', userId: 'student', exam: 'ssc-cgl', revision: 0, status: 'active', answers: {}, questions: [], events: [] });
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  vi.stubEnv('MONGODB_URI', mongo.getUri()); vi.stubEnv('MONGODB_DB', 'progress_revision_test');
  db = await connectMongoDB();
}, 60000);
beforeEach(async () => {
  shared.clear();
  for (const name of ['runtimeCacheRevisions', 'trainingSessions', 'trainingReviewState', 'mockAttempts', 'userQuestionProgress', 'userTopicProgress']) {
    await db.collection(name).deleteMany({});
  }
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => { await disconnectMongoDB(); await mongo?.stop(); vi.unstubAllEnvs(); });

it('commits topic progress and its generation together, ignoring surviving old Redis values', async () => {
  const old = await readTopicProgressCache('student');
  await writeTopicProgressCache(old.key, { solvedCount: 0 });
  await recordQuestionAnswer('student', 'uid-1', 'algebra', false, 'q1');
  const current = await readTopicProgressCache('student');
  expect(current).toEqual({ key: expect.stringMatching(/:1$/), value: null });
  expect((await db.collection('userTopicProgress').findOne({ userId: 'student' })).solvedCount).toBe(1);
  await recordQuestionAnswer('student', 'uid-1', 'algebra', true, 'q1');
  expect((await readTopicProgressCache('student')).key).toMatch(/:2$/);
  await recordQuestionAnswer('student', 'uid-1', 'algebra', true, 'q1');
  expect((await readTopicProgressCache('student')).key).toMatch(/:2$/);
});

it('advances each training dashboard mutation once and ignores optimistic conflicts', async () => {
  const old = await readTrainingDashboardCache('student', 'ssc-cgl');
  await writeTrainingDashboardCache(old.key, { active: [] });
  const source = fixture();
  await createTrainingSession(source);
  expect((await readTrainingDashboardCache('student', 'ssc-cgl')).key).toMatch(/:1$/);
  const updated = { ...source, revision: 1, answers: { q1: { correct: true } } };
  await commitTrainingTransition(source, updated);
  await commitTrainingTransition(source, updated);
  expect((await readTrainingDashboardCache('student', 'ssc-cgl')).key).toMatch(/:2$/);
  await saveTrainingDiagnosis(updated, { text: 'diagnosis' });
  await saveTrainingMistakes({ ...updated, revision: 2, result: { rows: [] } });
  expect(await readTrainingDashboardCache('student', 'ssc-cgl')).toEqual({ key: expect.stringMatching(/:4$/), value: null });
});

it('commits mock results with the dashboard generation and scopes it to the owner and exam', async () => {
  await db.collection('mockAttempts').insertOne({ id: 'mock', userId: 'student', examSlug: 'ssc-cgl', status: 'in_progress' });
  const filter = { id: 'mock', status: 'in_progress' };
  const update = { $set: { status: 'completed', result: { totalScore: 20 } } };
  await submitAttemptUpdate(filter, update);
  await submitAttemptUpdate(filter, update);
  expect((await readTrainingDashboardCache('student', 'ssc-cgl')).key).toMatch(/:1$/);
  expect((await readTrainingDashboardCache('student', 'ssc-mts')).key).toMatch(/:0$/);
  expect((await readTrainingDashboardCache('other', 'ssc-cgl')).key).toMatch(/:0$/);
});

it.each(['answer', 'training', 'mock'])('rolls back the %s source write if revision advancement fails', async kind => {
  const source = fixture();
  await db.collection('trainingSessions').insertOne(source);
  await db.collection('mockAttempts').insertOne({ id: 'mock', userId: 'student', examSlug: 'ssc-cgl', status: 'in_progress' });
  const original = Collection.prototype.updateOne;
  vi.spyOn(Collection.prototype, 'updateOne').mockImplementation(function (...args) {
    if (this.collectionName === 'runtimeCacheRevisions') throw new Error('Simulated revision write failure');
    return original.apply(this, args);
  });
  const mutation = kind === 'answer' ? () => recordQuestionAnswer('student', 'uid-1', 'algebra', true, 'q1')
    : kind === 'training' ? () => commitTrainingTransition(source, { ...source, revision: 1, answers: { q1: true } })
      : () => submitAttemptUpdate({ id: 'mock' }, { $set: { status: 'completed' } });
  await expect(mutation()).rejects.toThrow('Simulated revision write failure');
  expect(await db.collection('userQuestionProgress').countDocuments()).toBe(0);
  expect(await db.collection('userTopicProgress').countDocuments()).toBe(0);
  expect((await db.collection('trainingSessions').findOne({ id: 'training' })).revision).toBe(0);
  expect((await db.collection('mockAttempts').findOne({ id: 'mock' })).status).toBe('in_progress');
  expect(await db.collection('runtimeCacheRevisions').countDocuments()).toBe(0);
});
