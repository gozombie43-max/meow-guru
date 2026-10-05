import { beforeAll, afterAll, beforeEach, expect, it } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import { backfillCanonicalIdentity } from './identityBackfill.js';
import { resolveQuestion, assignQuestionIdentity } from './questionIdentity.js';
import { up } from '../../migrations/016-database-remediation.js';

let server, client, db;
beforeAll(async () => {
  server = await MongoMemoryServer.create();
  client = await new MongoClient(server.getUri()).connect();
  db = client.db('canonical_identity_fixture');
}, 120000);
afterAll(async () => { await client?.close(); await server?.stop(); });
beforeEach(async () => { await db.dropDatabase(); });

it('dry runs without writes, preserves ambiguous progress and is resumable', async () => {
  await db.collection('questions').insertMany([
    { id: 'same', topic: 'algebra', subject: 'math' },
    { id: 'same', topic: 'geometry', subject: 'math' },
  ]);
  await db.collection('userQuestionProgress').insertMany([
    { userId: 'a', questionId: 'same', topic: 'algebra', everCorrect: true },
    { userId: 'b', questionId: 'same', everCorrect: true },
  ]);
  const dry = await backfillCanonicalIdentity(db);
  expect(dry).toMatchObject({ unresolved: 1, questions: 2 });
  expect(await db.collection('questions').countDocuments({ questionUid: { $exists: true } })).toBe(0);
  expect(await db.collection('questionIdentityReview').countDocuments()).toBe(0);
  await backfillCanonicalIdentity(db, { apply: true });
  const rows = await db.collection('questions').find().toArray();
  expect(new Set(rows.map(q => q.questionUid)).size).toBe(2);
  await expect(resolveQuestion(db.collection('questions'), 'same')).rejects.toMatchObject({ statusCode: 409, code: 'AMBIGUOUS_QUESTION_ID' });
  expect((await resolveQuestion(db.collection('questions'), 'same', { topic: 'algebra' })).questionUid).toBe(rows[0].questionUid);
  expect(await db.collection('questionIdentityReview').countDocuments()).toBe(1);
  expect(await db.collection('userTopicProgress').findOne({ userId: 'a' })).toMatchObject({ solvedCount: 1, masteredCount: 1 });
  expect(await db.collection('userTopicProgress').findOne({ userId: 'b' })).toBeNull();
  expect((await backfillCanonicalIdentity(db, { apply: true })).changed).toBe(0);
  await up(db);
  await expect(db.collection('questions').insertOne({ questionUid: rows[0].questionUid })).rejects.toMatchObject({ code: 11000 });
});

it('reports normalized email collisions before applying anything', async () => {
  await db.collection('users').insertMany([{ id: 'a', email: ' Test@example.com ' }, { id: 'b', email: 'test@example.com' }]);
  expect((await backfillCanonicalIdentity(db)).accountCollisions).toHaveLength(1);
  await expect(backfillCanonicalIdentity(db, { apply: true })).rejects.toThrow('Account collisions');
  expect(await db.collection('users').countDocuments({ accountRecord: true })).toBe(0);
});

it('keeps import identities stable and rejects caller-selected identity', () => {
  const first = assignQuestionIdentity({ ingestionKey: 'retryable-row', questionUid: 'attacker' });
  expect(assignQuestionIdentity({ ingestionKey: 'retryable-row' }).questionUid).toBe(first.questionUid);
  expect(first.questionUid).toMatch(/^q_[a-f0-9]{32}$/);
  expect(assignQuestionIdentity({}).questionUid).not.toBe(assignQuestionIdentity({}).questionUid);
});
