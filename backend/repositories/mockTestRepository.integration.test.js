import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB } from '../config/mongodb.js';
import { getExamHistory, getTestHistory } from './mockTestRepository.js';

let mongo;
const previousUri = process.env.MONGODB_URI;
const previousDb = process.env.MONGODB_DB;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = 'mock_history_test';
  const db = await connectMongoDB();
  await db.collection('mockAttempts').insertMany([
    { id: 'older', userId: 'student', examSlug: 'ssc-mts', testId: 'test-1', status: 'completed', startedAt: 1, result: { totalScore: 10 }, _cosmosRid: 'legacy', answerKey: { q1: 'B' } },
    { id: 'newer', userId: 'student', examSlug: 'ssc-mts', testId: 'test-1', status: 'in_progress', startedAt: 2 },
    { id: 'other-user', userId: 'someone-else', examSlug: 'ssc-mts', testId: 'test-1' },
    { id: 'other-exam', userId: 'student', examSlug: 'ssc-cgl', testId: 'test-1' },
    { id: 'other-test', userId: 'student', examSlug: 'ssc-mts', testId: 'test-2', startedAt: 0 },
  ]);
}, 60000);

afterAll(async () => {
  await disconnectMongoDB();
  await mongo?.stop();
  if (previousUri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = previousUri;
  if (previousDb === undefined) delete process.env.MONGODB_DB;
  else process.env.MONGODB_DB = previousDb;
});

describe('mock history MongoDB queries', () => {
  it.each(['exam', 'test'])('returns scoped %s history without private or legacy fields', async (scope) => {
    const attempts = scope === 'exam'
      ? await getExamHistory('student', 'ssc-mts')
      : await getTestHistory('student', 'ssc-mts', 'test-1');
    expect(attempts.map(attempt => attempt.id)).toEqual(scope === 'exam' ? ['newer', 'older', 'other-test'] : ['newer', 'older']);
    expect(attempts[1].result).toEqual({ totalScore: 10 });
    for (const attempt of attempts) {
      for (const key of ['_id', '_cosmosRid', 'answerKey', 'userId']) {
        expect(attempt).not.toHaveProperty(key);
      }
    }
  });

  it('returns empty history for a user without attempts', async () => {
    expect(await getExamHistory('new-user', 'ssc-mts')).toEqual([]);
    expect(await getTestHistory('new-user', 'ssc-mts', 'test-1')).toEqual([]);
  });
});
