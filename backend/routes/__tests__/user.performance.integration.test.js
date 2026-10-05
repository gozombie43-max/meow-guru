vi.mock('../../auth/sessions.js', () => ({ assertSession: async decoded => decoded }));
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { signToken } from '../../auth/jwt.js';
import router from '../user.routes.js';

let mongo, db, server, base;
const headers = () => ({ Authorization: `Bearer ${signToken({ id: 'history-student' })}`, 'Content-Type': 'application/json' });
const call = (path, method = 'GET', body) => fetch(`${base}/users/me${path}`, { method, headers: headers(), body: body === undefined ? undefined : JSON.stringify(body) });
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri()); vi.stubEnv('MONGODB_DB', 'history_performance');
  db = await connectMongoDB();
  const app = express(); app.use(express.json()); app.use('/users', router);
  await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
}, 120000);
beforeEach(async () => {
  await db.collection('users').deleteMany({});
  await db.collection('users').insertOne({ id: 'history-student', name: 'Student', passwordHash: 'private', bookmarks: ['q'],
    progress: { algebra: { attempted: 1, correct: 1 } },
    aiChats: [{ id: 'saved', title: 'Saved', updatedAt: new Date().toISOString(), messages: [{ role: 'user', content: 'x'.repeat(12000) }] }],
    recentQuizzes: [{ quizKey: 'math:algebra', currentIndex: 240, status: 'in-progress', selectedAnswers: { 0: 1 }, submittedQuestions: [0], results: [{ questionIndex: 0 }] }] });
});
afterAll(async () => { await new Promise(resolve => server?.close(resolve)); await disconnectMongoDB(); await mongo?.stop(); vi.unstubAllEnvs(); });

describe('lean profile and durable incremental histories', () => {
  it('keeps history out of auth and index responses and loads only the requested details', async () => {
    const profile = await (await call('')).json();
    expect(profile).not.toHaveProperty('aiChats'); expect(profile).not.toHaveProperty('passwordHash');
    expect(profile.recentQuizzes[0]).not.toHaveProperty('results'); expect(profile.recentQuizzes[0]).not.toHaveProperty('selectedAnswers');
    expect(profile.bookmarks).toEqual(['q']); expect(profile.progress.algebra.correct).toBe(1);
    const index = await (await call('/ai-chats')).json();
    expect(index.aiChats[0]).toMatchObject({ id: 'saved', messageCount: 1, revision: 1 });
    expect(index.aiChats[0]).not.toHaveProperty('messages');
    expect((await (await call('/ai-chats/saved')).json()).aiChat.messages[0].content).toHaveLength(12000);
    expect((await (await call('/recent-quizzes/math%3Aalgebra')).json()).quiz.selectedAnswers).toEqual({ 0: 1 });
  });
  it('appends in order, handles lost-response retries, rejects stale turns and isolates users', async () => {
    const batch = { sequence: 2, messages: [{ role: 'bot', content: 'Answer' }] };
    expect(await (await call('/ai-chats/saved/messages', 'POST', batch)).json()).toEqual({ saved: true, revision: 2 });
    expect(await (await call('/ai-chats/saved/messages', 'POST', batch)).json()).toEqual({ saved: true, revision: 2 });
    expect((await call('/ai-chats/saved/messages', 'POST', { ...batch, messages: [{ role: 'bot', content: 'Stale' }] })).status).toBe(409);
    const chat = (await (await call('/ai-chats/saved')).json()).aiChat;
    expect(chat.messages).toHaveLength(2);
    const other = await fetch(`${base}/users/me/ai-chats/saved`, { headers: { Authorization: `Bearer ${signToken({ id: 'other' })}` } });
    expect(other.status).toBe(404);
  });
  it('does not lose separate concurrent chat updates', async () => {
    const responses = await Promise.all(['a', 'b', 'c'].map(id => call(`/ai-chats/${id}/messages`, 'POST', { sequence: 1, messages: [{ role: 'user', content: id }] })));
    expect(responses.map(response => response.status)).toEqual([200, 200, 200]);
    const index = await (await call('/ai-chats')).json();
    expect(index.aiChats.map(chat => chat.id).sort()).toEqual(['a', 'b', 'c', 'saved']);
  });
  it('deletes a chat without requiring identity in the projected history document', async () => {
    expect(await (await call('/ai-chats/saved', 'DELETE')).json()).toEqual({ saved: true });
    expect((await (await call('/ai-chats')).json()).aiChats).toEqual([]);
    expect((await call('/ai-chats/saved')).status).toBe(404);
  });
  it('merges resume deltas idempotently without erasing previous answers or results', async () => {
    const delta = { quizKey: 'math:algebra', title: 'Algebra', subject: 'math', href: '/quiz', currentIndex: 241,
      delta: true, selectedAnswers: { 240: 2 }, submittedQuestions: [240], results: [{ questionIndex: 240 }], questionAnchor: 'anchor' };
    for (let i = 0; i < 2; i++) expect(await (await call('/recent-quizzes', 'PATCH', delta)).json()).toEqual({ saved: true });
    const { quiz } = await (await call('/recent-quizzes/math%3Aalgebra')).json();
    expect(quiz.selectedAnswers).toEqual({ 0: 1, 240: 2 }); expect(quiz.submittedQuestions).toEqual([0, 240]); expect(quiz.results).toHaveLength(2);
    await call('/recent-quizzes', 'PATCH', { ...delta, selectedAnswers: {}, removedAnswers: [0] });
    expect((await (await call('/recent-quizzes/math%3Aalgebra')).json()).quiz.selectedAnswers).toEqual({ 240: 2 });
  });
});
