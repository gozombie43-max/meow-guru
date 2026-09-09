import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { Collection } from 'mongodb';
import express from 'express';
import { once } from 'node:events';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createSession } from '../../auth/sessions.js';
import router from '../mocktest.js';
import { up as readinessIndexes } from '../../migrations/004-readiness.js';
import { uploadFullPaper } from '../../services/mockTestEngine.js';

vi.mock('../../services/mockPublicationNotificationService.js', () => ({ notifyNewMockPublished: vi.fn() }));
let mongo, db, server, base;
let token;
async function request(path, method = 'GET', body, auth = token) {
  return fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function start() {
  const response = await request('/ssc-cgl/audit-test/start', 'POST');
  expect(response.status).toBe(201);
  return response.json();
}
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = 'mock_audit';
  db = await connectMongoDB();
  await readinessIndexes(db);
  const app = express();
  app.use(express.json());
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}, 60000);
beforeEach(async () => {
  await db.collection('users').updateOne({ id: 'student' }, { $set: { id: 'student' } }, { upsert: true });
  token = (await createSession({ id: 'student' })).token;
  await db.collection('mockAttempts').deleteMany({});
  await db.collection('mockSlots').deleteMany({});
  await db.collection('mockSlots').insertOne({
    id: 'audit-test', examSlug: 'ssc-cgl', configKey: 'ssc-cgl-tier1', title: 'Audit test',
    fixedQuestions: ['quant', 'ga', 'reasoning', 'english'].map(key => ({
      id: key, sectionKey: key, question: 'Two plus two?', options: ['3', '4', '5', '6'],
      correctAnswer: 'B', solution: 'The answer is four', solutionImage: '/secret.png',
      explanation: 'Private explanation', correctIndex: 1,
    })),
  });
});
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await disconnectMongoDB();
  await mongo?.stop();
});

describe('mock test HTTP and MongoDB contract', () => {
  it('keeps confidential uploads out of the practice bank and refuses a public downgrade', async () => {
    const questions = ['ga', 'reasoning', 'quant', 'english'].flatMap(section => Array.from({ length: 25 }, (_, i) => ({
      id: `private-${section}-${i}`, section, question: 'Question', options: ['one', 'two'], correctAnswer: 1,
    })));
    const slot = { id: 'private-upload', title: 'Private', examSlug: 'ssc-cgl', configKey: 'ssc-cgl-tier1', assessmentMode: 'confidential' };
    const uploaded = await uploadFullPaper({ slotData: slot, questions });
    expect(uploaded.insertedToBank).toBe(0);
    expect(await db.collection('questions').countDocuments({ id: { $in: questions.map(question => question.id) } })).toBe(0);
    await expect(uploadFullPaper({ slotData: { ...slot, assessmentMode: 'practice' }, questions })).rejects.toMatchObject({ statusCode: 422 });
  });
  it('enforces confidential paper completeness, one attempt and no completed answer review', async () => {
    await db.collection('mockSlots').updateOne({ id: 'audit-test' }, { $set: { assessmentMode: 'confidential' } });
    expect((await request('/ssc-cgl/audit-test/start', 'POST')).status).toBe(422);
    const fixedQuestions = ['ga', 'reasoning', 'quant', 'english'].flatMap(sectionKey => Array.from({ length: 25 }, (_, i) => ({
      id: `${sectionKey}-${i}`, sectionKey, question: 'Question', options: ['one', 'two'], correctAnswer: 1, solution: 'secret solution',
    })));
    await db.collection('mockSlots').updateOne({ id: 'audit-test' }, { $set: { fixedQuestions } });
    const attempts = await Promise.all(Array.from({ length: 4 }, async () => (await request('/ssc-cgl/audit-test/start', 'POST')).json()));
    expect(new Set(attempts.map(item => item.id)).size).toBe(1);
    const id = attempts[0].id;
    await request(`/attempt/${id}/submit`, 'POST');
    const completed = await (await request(`/attempt/${id}`)).json();
    expect(completed.status).toBe('completed');
    expect(completed.answerKey).toBeUndefined();
    expect(JSON.stringify(completed)).not.toContain('secret solution');
    expect((await (await request('/ssc-cgl/audit-test/start', 'POST')).json()).id).toBe(id);
  });

  it('rejects stale compare-and-swap saves rather than overwriting a different tab', async () => {
    const attempt = await start();
    await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { baseRevision: 0, revision: 1, answers: { quant: '1' } });
    const stale = await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { baseRevision: 0, revision: 2, answers: { quant: '0' } });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('REVISION_CONFLICT');
  });

  it('reuses an idempotent start across concurrent retries', async () => {
    const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(`${base}/ssc-cgl/audit-test/start`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': 'same-start-request' },
    })));
    const attempts = await Promise.all(responses.map(response => response.json()));
    expect(new Set(attempts.map(attempt => attempt.id)).size).toBe(1);
  });
  it('hides fixed answers from public details and solutions from start/resume while retaining completed review', async () => {
    const slot = await (await request('/slots/audit-test')).json();
    expect(slot.slot.fixedQuestions).toBeUndefined();
    expect(slot.slot.hasFixedPaper).toBe(true);
    const attempt = await start();
    for (const payload of [attempt, await (await request(`/attempt/${attempt.id}`)).json()]) {
      expect(payload.answerKey).toBeUndefined();
      expect(payload.paper.sections.flatMap(section => section.questions)).toHaveLength(4);
      expect(JSON.stringify(payload)).not.toMatch(/secret.png|Private explanation|correctIndex|The answer is four/);
    }
    await request(`/attempt/${attempt.id}/submit`, 'POST');
    const reviewed = await (await request(`/attempt/${attempt.id}`)).json();
    expect(reviewed.answerKey.quant).toBe('1');
    expect(JSON.stringify(reviewed.paper)).toContain('The answer is four');
  });

  it('grades UI indices against letter keys and makes simultaneous submissions idempotent', async () => {
    const attempt = await start();
    expect((await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 1, answers: { quant: '1' } })).status).toBe(200);
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(`/attempt/${attempt.id}/submit`, 'POST')));
    expect(responses.every(response => response.status === 200)).toBe(true);
    const results = await Promise.all(responses.map(response => response.json()));
    expect(results.every(value => value.result.totalScore === 2)).toBe(true);
    expect(new Set(results.map(value => JSON.stringify(value.result))).size).toBe(1);
    expect((await db.collection('mockAttempts').findOne({ id: attempt.id })).status).toBe('completed');
  });

  it('recovers a legacy submission left behind by a crashed process', async () => {
    const attempt = await start();
    await db.collection('mockAttempts').updateOne({ id: attempt.id }, { $set: { status: 'submitting', submitClaimedAt: new Date(0) } });
    expect((await request(`/attempt/${attempt.id}/submit`, 'POST')).status).toBe(200);
  });

  it('refuses to publish a grade if an autosave changes the snapshot during grading', async () => {
    const attempt = await start();
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    const original = Collection.prototype.countDocuments;
    const spy = vi.spyOn(Collection.prototype, 'countDocuments').mockImplementation(async function (...args) {
      entered();
      await gate;
      return original.apply(this, args);
    });
    const submitting = request(`/attempt/${attempt.id}/submit`, 'POST');
    try {
      await started;
      await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 1, answers: { quant: '1' } });
      release();
      expect((await submitting).status).toBe(409);
    } finally { release(); spy.mockRestore(); }
    const retry = await (await request(`/attempt/${attempt.id}/submit`, 'POST')).json();
    expect(retry.result.totalScore).toBe(2);
  });

  it('rejects expired autosaves but allows submission, and isolates ownership', async () => {
    const attempt = await start();
    await db.collection('mockAttempts').updateOne({ id: attempt.id }, { $set: { deadlineAt: new Date(0) } });
    const save = await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 1, answers: { quant: '1' } });
    expect(save.status).toBe(409);
    expect((await save.json()).expired).toBe(true);
    await db.collection('users').insertOne({ id: 'other-student' });
    const other = (await createSession({ id: 'other-student' })).token;
    expect((await request(`/attempt/${attempt.id}`, 'GET', undefined, other)).status).toBe(404);
    expect((await request(`/attempt/${attempt.id}/submit`, 'POST', undefined, other)).status).toBe(404);
    expect((await request(`/attempt/${attempt.id}/submit`, 'POST')).status).toBe(200);
  });

  it('does not allow older autosaves to overwrite newer answers or completed attempts', async () => {
    const attempt = await start();
    await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 2, answers: { quant: '1' } });
    await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 1, answers: { quant: '0' } });
    await request(`/attempt/${attempt.id}/submit`, 'POST');
    expect((await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 3, answers: {} })).status).toBe(409);
    const stored = await db.collection('mockAttempts').findOne({ id: attempt.id });
    expect(stored.answers).toEqual({ quant: '1' });
    expect(stored.result.totalScore).toBe(2);
  });
});
