import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Collection } from 'mongodb';
import express from 'express';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { signToken } from '../../auth/jwt.js';
import usersRouter from '../user.routes.js';
import questionsRouter from '../questionRoutes.js';
import { up as historyIndexes } from '../../migrations/017-user-history.js';
import { up as progressIndexes } from '../../migrations/016-database-remediation.js';
import { migrateUserHistory } from '../../repositories/userHistoryRepository.js';
import { mutateUserList } from '../../repositories/userRepository.js';
import { enqueueConceptGrouping } from '../../repositories/conceptGroupRepository.js';
import { clearSharedLocalCaches } from '../../infrastructure/tieredCache.js';
import { fetchSlotsForExam } from '../../services/mock/mockSlotService.js';

vi.mock('../../auth/sessions.js', () => ({ assertSession: async decoded => decoded }));
let mongo, db, server, base;
const call = (path, method = 'GET', body, userId = 'student', key = body?.submissionId) => fetch(`${base}${path}`, {
  method, headers: { Authorization: `Bearer ${signToken({ id: userId })}`, 'Content-Type': 'application/json', ...(key ? { 'Idempotency-Key': key } : {}) },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const chatPath = id => `/users/me/ai-chats${id ? `/${id}` : ''}`;
const message = content => ({ role: 'user', content });
const command = (overrides = {}) => ({ questionId: 'shared-id', questionUid: `q_${'1'.repeat(32)}`, answer: 1,
  submissionId: 'answer_key_1', questionIndex: 0, timeTaken: 12,
  resume: { quizKey: 'mathematics:algebra', title: 'Algebra', subject: 'mathematics', href: '/quiz',
    currentIndex: 0, totalQuestions: 2, selectedAnswers: {}, submittedQuestions: [], results: [], delta: true }, ...overrides });

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  vi.stubEnv('MONGODB_URI', mongo.getUri()); vi.stubEnv('MONGODB_DB', 'request_flow_batch_b');
  db = await connectMongoDB();
  await historyIndexes(db); await progressIndexes(db);
  await db.collection('userTopicProgress').createIndex({ userId: 1, topic: 1 }, { unique: true });
  const app = express(); app.use(express.json({ limit: '2mb' }));
  app.use('/users', usersRouter); app.use('/api/questions', questionsRouter);
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
}, 120000);
beforeEach(async () => {
  vi.restoreAllMocks(); clearSharedLocalCaches();
  for (const name of ['users', 'questions', 'userQuestionProgress', 'userTopicProgress', 'userQuizHistory',
    'aiConversations', 'aiMessages', 'idempotencyRecords', 'runtimeCacheRevisions', 'conceptGroupMetadata', 'mockSlots']) await db.collection(name).deleteMany({});
  await db.collection('users').insertMany([{ id: 'student', historyStorageVersion: 1 }, { id: 'other', historyStorageVersion: 1 }]);
  await db.collection('questions').insertMany([
    { id: 'shared-id', questionUid: `q_${'1'.repeat(32)}`, topic: 'algebra', subject: 'mathematics', concept: 'Linear equations', options: ['3', '4'], correctAnswer: 'B', difficulty: 'medium' },
    { id: 'shared-id', questionUid: `q_${'2'.repeat(32)}`, topic: 'geometry', subject: 'mathematics', concept: 'Angles', options: ['3', '4'], correctAnswer: 0 },
  ]);
});
afterAll(async () => {
  vi.restoreAllMocks(); if (server) await new Promise(resolve => server.close(resolve));
  await disconnectMongoDB(); await mongo?.stop(); vi.unstubAllEnvs();
});

async function seedChats(count = 3) {
  const chats = Array.from({ length: count }, (_, i) => ({ id: `chat-${i}`, title: `Chat ${i}`,
    updatedAt: new Date(Date.now() - i * 1000).toISOString(), revision: 80, messages: Array.from({ length: 80 }, (_, n) => message(`${i}:${n}:${'x'.repeat(100)}`)) }));
  await db.collection('users').updateOne({ id: 'student' }, { $unset: { historyStorageVersion: '' }, $set: { aiChats: chats } });
  await migrateUserHistory(db, await db.collection('users').findOne({ id: 'student' }), { apply: true });
}

describe('scoped migrated chat persistence', () => {
  it('keeps non-separated list mutations available after history migration', async () => {
    expect(await mutateUserList('student', 'bookmarks', rows => [...rows, 'bookmark'])).toEqual(['bookmark']);
    expect((await db.collection('users').findOne({ id: 'student' })).bookmarks).toEqual(['bookmark']);
  });
  it('lists metadata without querying messages and scopes detail to one conversation', async () => {
    await seedChats();
    const original = Collection.prototype.find, reads = [];
    vi.spyOn(Collection.prototype, 'find').mockImplementation(function (...args) {
      if (this.collectionName === 'aiMessages') reads.push(args[0]);
      return original.apply(this, args);
    });
    const index = await (await call(chatPath())).json();
    expect(index.aiChats).toHaveLength(3); expect(index.aiChats[0]).toMatchObject({ id: 'chat-0', messageCount: 80, revision: 80 });
    expect(index.aiChats[0]).not.toHaveProperty('messages'); expect(reads).toEqual([]);
    const detail = await (await call(chatPath('chat-1'))).json();
    expect(detail.aiChat.messages).toHaveLength(80);
    expect(reads).toEqual([{ userId: 'student', conversationId: 'chat-1' }]);
    expect((await call(chatPath('chat-1'), 'GET', undefined, 'other')).status).toBe(404);
  });
  it('appends only new rows, retains existing row identities, trims the window, and validates retries', async () => {
    await seedChats();
    const retained = await db.collection('aiMessages').findOne({ userId: 'student', conversationId: 'chat-0', position: 79 });
    const untouched = await db.collection('aiMessages').findOne({ userId: 'student', conversationId: 'chat-1', position: 0 });
    const original = Collection.prototype.find, reads = [];
    vi.spyOn(Collection.prototype, 'find').mockImplementation(function (...args) {
      if (this.collectionName === 'aiMessages') reads.push(args[0]);
      return original.apply(this, args);
    });
    const batch = { sequence: 81, messages: [message('new')] };
    expect(await (await call(`${chatPath('chat-0')}/messages`, 'POST', batch)).json()).toEqual({ saved: true, revision: 81 });
    expect(reads).toEqual([]);
    expect(await db.collection('aiMessages').countDocuments({ userId: 'student', conversationId: 'chat-0' })).toBe(80);
    expect((await db.collection('aiMessages').findOne({ _id: retained._id })).position).toBe(79);
    expect(await db.collection('aiMessages').findOne({ _id: untouched._id })).toEqual(untouched);
    reads.length = 0;
    expect(await (await call(`${chatPath('chat-0')}/messages`, 'POST', batch)).json()).toEqual({ saved: true, revision: 81 });
    expect(reads).toEqual([{ userId: 'student', conversationId: 'chat-0', position: { $gte: 80, $lt: 81 } }]);
    expect((await call(`${chatPath('chat-0')}/messages`, 'POST', { ...batch, messages: [message('different')] })).status).toBe(409);
    expect((await call(`${chatPath('chat-0')}/messages`, 'POST', { sequence: 1, messages: [message('evicted')] })).status).toBe(409);
  });
  it('upgrades an old retained-window position range without unique-index collisions', async () => {
    await seedChats(1);
    await db.collection('aiConversations').updateOne({ userId: 'student', id: 'chat-0' }, { $set: { revision: 90 } });
    const batch = { sequence: 91, messages: [message('next')] };
    expect((await call(`${chatPath('chat-0')}/messages`, 'POST', batch)).status).toBe(200);
    const rows = await db.collection('aiMessages').find({ userId: 'student', conversationId: 'chat-0' }).sort({ position: 1 }).toArray();
    expect(rows).toHaveLength(80); expect(rows[0].position).toBe(11); expect(rows.at(-1).position).toBe(90);
    expect((await call(`${chatPath('chat-0')}/messages`, 'POST', { sequence: 90, messages: [message(`0:79:${'x'.repeat(100)}`)] })).status).toBe(200);
  });
  it('serializes competing appends without replacing the winning turn', async () => {
    await seedChats(1);
    const responses = await Promise.all(['a', 'b'].map(content => call(`${chatPath('chat-0')}/messages`, 'POST', { sequence: 81, messages: [message(content)] })));
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect((await db.collection('aiConversations').findOne({ userId: 'student', id: 'chat-0' })).revision).toBe(81);
    const same = { sequence: 1, messages: [message('same')] };
    const duplicate = await Promise.all([call(`${chatPath('fresh')}/messages`, 'POST', same), call(`${chatPath('fresh')}/messages`, 'POST', same)]);
    expect(duplicate.map(response => response.status)).toEqual([200, 200]);
    expect(await db.collection('aiMessages').countDocuments({ userId: 'student', conversationId: 'fresh' })).toBe(1);
  });
  it('caps the catalog and deletes only the selected owner conversation', async () => {
    await seedChats(30);
    expect((await call(`${chatPath('fresh')}/messages`, 'POST', { sequence: 1, messages: [message('new')] })).status).toBe(200);
    expect(await db.collection('aiConversations').countDocuments({ userId: 'student' })).toBe(30);
    expect(await db.collection('aiMessages').countDocuments({ userId: 'student', conversationId: 'chat-29' })).toBe(0);
    const original = Collection.prototype.find, reads = [];
    vi.spyOn(Collection.prototype, 'find').mockImplementation(function (...args) {
      if (this.collectionName === 'aiMessages') reads.push(args[0]);
      return original.apply(this, args);
    });
    expect((await call(chatPath('chat-0'), 'DELETE')).status).toBe(200); expect(reads).toEqual([]);
    expect(await db.collection('aiMessages').countDocuments({ userId: 'student', conversationId: 'chat-0' })).toBe(0);
    expect(await db.collection('aiMessages').countDocuments({ userId: 'student', conversationId: 'chat-1' })).toBe(80);
  });
  it('does not commit an append after its account is deleted', async () => {
    const original = Collection.prototype.updateOne;
    let removed = false;
    vi.spyOn(Collection.prototype, 'updateOne').mockImplementation(async function (...args) {
      if (!removed && this.collectionName === 'users' && args[1].$inc?.aiChatsRevision) {
        removed = true; await db.collection('users').deleteOne({ id: 'student' });
      }
      return original.apply(this, args);
    });
    expect((await call(`${chatPath('fresh')}/messages`, 'POST', { sequence: 1, messages: [message('new')] })).status).toBe(404);
    expect(await db.collection('aiConversations').countDocuments({ userId: 'student' })).toBe(0);
    expect(await db.collection('aiMessages').countDocuments({ userId: 'student' })).toBe(0);
  });
  it('fences a legacy save that crosses history migration', async () => {
    await db.collection('users').updateOne({ id: 'student' }, { $unset: { historyStorageVersion: '' }, $set: { aiChats: [{ id: 'old', messages: [message('old')] }] } });
    const original = Collection.prototype.updateOne;
    let migrated = false;
    vi.spyOn(Collection.prototype, 'updateOne').mockImplementation(async function (...args) {
      if (!migrated && this.collectionName === 'users' && args[0].aiChatsRevision && args[0].historyStorageVersion?.$ne === 1) {
        migrated = true;
        await migrateUserHistory(db, await db.collection('users').findOne({ id: 'student' }), { apply: true });
      }
      return original.apply(this, args);
    });
    expect((await call(`${chatPath('fresh')}/messages`, 'POST', { sequence: 1, messages: [message('new')] })).status).toBe(200);
    expect(migrated).toBe(true);
    expect((await (await call(chatPath())).json()).aiChats.map(row => row.id).sort()).toEqual(['fresh', 'old']);
  });
});

describe('atomic practice quiz answer command', () => {
  it.each([false, true])('commits counters, canonical progress and resume together (migrated=%s)', async migrated => {
    if (!migrated) await db.collection('users').updateOne({ id: 'student' }, { $unset: { historyStorageVersion: '' }, $set: { recentQuizzes: [{ quizKey: 'mathematics:algebra', selectedAnswers: { 5: 0 }, submittedQuestions: [5], results: [{ questionIndex: 5 }] }] } });
    const response = await call('/api/questions/answer', 'POST', command());
    expect(response.status).toBe(200); expect(await response.json()).toMatchObject({ isCorrect: true, isFirstTime: true, becameMastered: true, resumeSaved: true });
    const owner = await db.collection('users').findOne({ id: 'student' });
    expect(owner.progress['Linear equations']).toEqual({ attempted: 1, correct: 1 }); expect(owner.recentQuizzesRevision).toBe(1);
    const resume = migrated ? await db.collection('userQuizHistory').findOne({ userId: 'student' }) : owner.recentQuizzes[0];
    expect(resume.selectedAnswers[0]).toBe(1); expect(resume.submittedQuestions).toContain(0);
    expect(resume.results.find(row => row.questionIndex === 0)).toMatchObject({ isCorrect: true, correct: 1, questionUid: `q_${'1'.repeat(32)}` });
    if (!migrated) expect(resume.selectedAnswers[5]).toBe(0);
    expect(await db.collection('userQuestionProgress').countDocuments({ userId: 'student' })).toBe(1);
    expect((await db.collection('userTopicProgress').findOne({ userId: 'student' })).masteredCount).toBe(1);
    expect((await db.collection('runtimeCacheRevisions').findOne({})).counter).toBe(1);
  });
  it('replays simultaneous and later duplicates, rejects changed input and scopes keys to owners', async () => {
    const responses = await Promise.all(Array.from({ length: 5 }, () => call('/api/questions/answer', 'POST', command())));
    expect(responses.map(response => response.status)).toEqual([200, 200, 200, 200, 200]);
    const repeat = await call('/api/questions/answer', 'POST', command());
    expect(repeat.headers.get('Idempotency-Replayed')).toBe('true');
    expect((await db.collection('users').findOne({ id: 'student' })).progress['Linear equations'].attempted).toBe(1);
    expect((await db.collection('userQuestionProgress').findOne({ userId: 'student' })).attempts).toBe(1);
    expect((await call('/api/questions/answer', 'POST', command({ answer: 0 }))).status).toBe(409);
    expect((await call('/api/questions/answer', 'POST', command(), 'other')).status).toBe(200);
    expect(await db.collection('idempotencyRecords').countDocuments({ status: 'completed' })).toBe(2);
  });
  it('counts separate attempts but advances mastery only once', async () => {
    expect((await call('/api/questions/answer', 'POST', command({ answer: 0 }))).status).toBe(200);
    expect((await call('/api/questions/answer', 'POST', command({ submissionId: 'answer_key_2' }))).status).toBe(200);
    expect((await call('/api/questions/answer', 'POST', command({ submissionId: 'answer_key_3' }))).status).toBe(200);
    expect((await db.collection('users').findOne({ id: 'student' })).progress['Linear equations']).toEqual({ attempted: 3, correct: 2 });
    expect((await db.collection('userTopicProgress').findOne({ userId: 'student' }))).toMatchObject({ solvedCount: 1, masteredCount: 1 });
  });
  it('preserves different questions sharing a legacy ID and rejects ambiguous lookup', async () => {
    const ambiguous = command(); delete ambiguous.questionUid;
    expect((await call('/api/questions/answer', 'POST', ambiguous)).status).toBe(409);
    expect(await db.collection('idempotencyRecords').countDocuments({})).toBe(0);
    await call('/api/questions/answer', 'POST', command());
    await call('/api/questions/answer', 'POST', command({ questionUid: `q_${'2'.repeat(32)}`, answer: 0, questionIndex: 1, submissionId: 'answer_key_2' }));
    expect(await db.collection('userQuestionProgress').countDocuments({ userId: 'student' })).toBe(2);
    expect((await db.collection('userQuizHistory').findOne({ userId: 'student' })).results).toHaveLength(2);
  });
  it('rolls back every effect and the reservation if history persistence fails', async () => {
    const original = Collection.prototype.replaceOne;
    vi.spyOn(Collection.prototype, 'replaceOne').mockImplementation(function (...args) {
      if (this.collectionName === 'userQuizHistory') throw new Error('Injected history failure');
      return original.apply(this, args);
    });
    expect((await call('/api/questions/answer', 'POST', command())).status).toBe(500);
    for (const name of ['userQuestionProgress', 'userTopicProgress', 'runtimeCacheRevisions', 'idempotencyRecords']) expect(await db.collection(name).countDocuments({})).toBe(0);
    expect((await db.collection('users').findOne({ id: 'student' })).progress).toBeUndefined();
    vi.restoreAllMocks(); expect((await call('/api/questions/answer', 'POST', command())).status).toBe(200);
  });
  it('uses the session anchor for unmigrated questions with duplicate legacy IDs', async () => {
    const question = await db.collection('questions').findOne({ topic: 'geometry' });
    await db.collection('questions').updateMany({}, { $unset: { questionUid: '' } });
    const body = command({ questionAnchor: String(question._id), answer: 0 }); delete body.questionUid;
    const response = await call('/api/questions/answer', 'POST', body);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ isCorrect: true, concept: 'Angles' });
    expect((await db.collection('userQuestionProgress').findOne({ userId: 'student' })).topic).toBe('geometry');
  });
  it('stores literal concept keys and overrides untrusted resume grading', async () => {
    await db.collection('questions').updateOne({ questionUid: `q_${'1'.repeat(32)}` }, { $set: { concept: 'S.I. $ principal' } });
    const body = command({ answer: 0 }); body.resume.results = [{ questionIndex: 0, isCorrect: true, correct: 0 }];
    expect((await call('/api/questions/answer', 'POST', body)).status).toBe(200);
    expect((await db.collection('users').findOne({ id: 'student' })).progress['S.I. $ principal']).toEqual({ attempted: 1, correct: 0 });
    expect((await db.collection('userQuizHistory').findOne({ userId: 'student' })).results[0]).toMatchObject({ isCorrect: false, correct: 1 });
  });
  it('rejects missing/mismatched keys, invalid options, and deleted owners without writes', async () => {
    expect((await call('/api/questions/answer', 'POST', command(), 'student', '')).status).toBe(400);
    expect((await call('/api/questions/answer', 'POST', command(), 'student', 'different_key')).status).toBe(400);
    expect((await call('/api/questions/answer', 'POST', command({ answer: 5 }))).status).toBe(400);
    expect((await call('/api/questions/answer', 'POST', command(), 'missing')).status).toBe(404);
    expect(await db.collection('idempotencyRecords').countDocuments({})).toBe(0);
  });
  it('rolls back the answer if account deletion races the owner update', async () => {
    const original = Collection.prototype.updateOne;
    let removed = false;
    vi.spyOn(Collection.prototype, 'updateOne').mockImplementation(async function (...args) {
      if (!removed && this.collectionName === 'users' && Array.isArray(args[1])) {
        removed = true; await db.collection('users').deleteOne({ id: 'student' });
      }
      return original.apply(this, args);
    });
    expect((await call('/api/questions/answer', 'POST', command())).status).toBe(404);
    for (const name of ['userQuestionProgress', 'userTopicProgress', 'userQuizHistory', 'idempotencyRecords']) expect(await db.collection(name).countDocuments({})).toBe(0);
  });
});

describe('metadata and catalog database work', () => {
  it('reads completed grouping once and does no warm upsert/read, while pending status stays fresh', async () => {
    await db.collection('conceptGroupMetadata').insertOne({ _id: 'completed', status: 'completed', result: { groups: [] } });
    const read = vi.spyOn(Collection.prototype, 'findOne'), write = vi.spyOn(Collection.prototype, 'updateOne');
    await Promise.all(Array.from({ length: 10 }, () => enqueueConceptGrouping('completed', {})));
    await enqueueConceptGrouping('completed', {});
    expect(read.mock.calls).toHaveLength(1); expect(write.mock.calls).toHaveLength(0);
    await enqueueConceptGrouping('pending', { status: 'queued' });
    await db.collection('conceptGroupMetadata').updateOne({ _id: 'pending' }, { $set: { status: 'completed', result: { groups: ['ready'] } } });
    expect((await enqueueConceptGrouping('pending', {})).result.groups).toEqual(['ready']);
    read.mockClear(); write.mockClear(); await enqueueConceptGrouping('pending', {});
    expect(read.mock.calls).toHaveLength(0); expect(write.mock.calls).toHaveLength(0);
  });
  it('returns accurate fixed/dynamic/empty counts from a Mongo catalog that excludes papers', async () => {
    await db.collection('mockSlots').insertMany([
      { id: 'fixed', examSlug: 'ssc-cgl', order: 1, fixedQuestions: Array.from({ length: 4 }, () => ({ solution: 'private content' })) },
      { id: 'empty', examSlug: 'ssc-cgl', order: 2, fixedQuestions: [], questionCount: 100 },
      { id: 'dynamic', examSlug: 'ssc-cgl', order: 3, questionCount: 75 },
      { id: 'other', examSlug: 'other', fixedQuestions: [{}] },
    ]);
    const spy = vi.spyOn(Collection.prototype, 'aggregate');
    const rows = await fetchSlotsForExam('ssc-cgl');
    expect(rows.map(row => [row.id, row.hasFixedPaper, row.questionCount])).toEqual([['fixed', true, 4], ['empty', false, 100], ['dynamic', false, 75]]);
    expect(JSON.stringify(rows)).not.toContain('private content'); expect(rows.every(row => !('fixedQuestions' in row))).toBe(true);
    expect(spy.mock.calls[0][0].at(-1)).toEqual({ $project: { fixedQuestions: 0, _fixedCount: 0, _id: 0, _cosmosRid: 0 } });
  });
});
