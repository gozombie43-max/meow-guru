import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Collection, ObjectId } from 'mongodb';
import { once } from 'node:events';

const redisState = vi.hoisted(() => {
  const store = new Map();
  let failMode = false;
  let gets = 0;
  let sets = 0;

  const client = {
    isReady: true,
    isOpen: true,
    get: vi.fn(async (key) => {
      gets++;
      if (failMode) throw new Error('Simulated Redis outage');
      return store.has(key) ? store.get(key) : null;
    }),
    mGet: vi.fn(async (keys) => {
      if (failMode) throw new Error('Simulated Redis outage');
      return keys.map((k) => (store.has(k) ? store.get(k) : null));
    }),
    set: vi.fn(async (key, value, opts) => {
      sets++;
      if (failMode) throw new Error('Simulated Redis outage');
      if (opts?.NX && store.has(key)) return null;
      store.set(key, value);
      return 'OK';
    }),
    del: vi.fn(async (keys) => {
      if (failMode) throw new Error('Simulated Redis outage');
      const arr = Array.isArray(keys) ? keys : [keys];
      let removed = 0;
      for (const k of arr) {
        if (store.delete(k)) removed++;
      }
      return removed;
    }),
    eval: vi.fn(async () => {
      if (failMode) throw new Error('Simulated Redis outage');
      return 1;
    }),
  };

  return {
    store,
    client,
    setFailMode: (next) => {
      failMode = Boolean(next);
    },
    getStats: () => ({ gets, sets, size: store.size }),
    reset: () => {
      store.clear();
      failMode = false;
      gets = 0;
      sets = 0;
      vi.clearAllMocks();
    },
  };
});

vi.mock('../../../config/redis.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getRedisClient: vi.fn(async () => redisState.client),
    getRateLimitRedisClient: vi.fn(async () => redisState.client),
    redisGetJson: vi.fn(async (key) => {
      const val = await redisState.client.get(`test:${key}`).catch(() => null);
      return val == null ? null : JSON.parse(val);
    }),
    redisGetJsonMany: vi.fn(async (keys) => {
      if (!keys.length) return [];
      try {
        const vals = await redisState.client.mGet(keys.map((k) => `test:${k}`));
        return vals.map((val) => (val == null ? null : JSON.parse(val)));
      } catch {
        return keys.map(() => null);
      }
    }),
    redisSetJson: vi.fn(async (key, value) => {
      try {
        await redisState.client.set(`test:${key}`, JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    }),
    redisDelete: vi.fn(async (...keys) => {
      try {
        await redisState.client.del(keys.map((k) => `test:${k}`));
      } catch {
        // fallback silently
      }
    }),
  };
});

import { connectMongoDB, disconnectMongoDB } from '../../../config/mongodb.js';
import { migrate } from '../../../migrations/runner.js';
import { createSession } from '../../../auth/sessions.js';
import { createApp } from '../../../app.js';
import { buildNormalizedQuestionFields } from '../../../services/questions/questionNormalizer.js';
import { canonicalQuestionUid } from '../../../services/questions/questionIdentity.js';
import * as migration028 from '../../../migrations/028-backfill-question-uids.js';
import { invalidateQuestionCacheRevision, invalidateQuestionCaches } from '../../../services/questions/questionCache.js';
import { fetchQuestionCursorPage } from '../../../services/questions/questionCursorService.js';
import { fetchQuestionsSession } from '../../../services/questions/questionSessionService.js';
import { activePaper, reviewPaper } from '../../../services/mockTestPresentation.js';
import { clearSharedLocalCaches } from '../../../infrastructure/tieredCache.js';
import { resetCacheHitSummary } from '../../../infrastructure/metrics.js';

const SENSITIVE_FIELDS = [
  'correctAnswer',
  'correctLetter',
  'correctIndex',
  'solution',
  'solutionImage',
  'solutionImageWidth',
  'solutionImageHeight',
  'explanation',
  'answerKey',
  'ingestionKey',
  'ingestionHash',
  'battleSelectionKey',
  'trainingCandidate',
  'trainingEligible',
  'trainingMetadataVersion',
];

let mongo;
let db;
let server;
let baseUrl;
let tokenA;
let tokenB;

async function api(path, { method = 'GET', body, token = tokenA, headers = {} } = {}) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

function makeSeedQuestions(count = 55) {
  return Array.from({ length: count }, (_, idx) => {
    const n = idx + 1;
    const isAi = n <= 12;
    const base = {
      id: n, // numeric id also validates questionCursorService numeric boundary fix
      questionUid: `q_${String(n).padStart(32, '0')}`,
      subject: 'mathematics',
      topic: n <= 45 ? 'algebra' : 'geometry',
      chapter: n <= 45 ? 'linear-equations' : 'triangles',
      concept: n % 2 === 0 ? 'Linear Equations' : 'Quadratics',
      difficulty: n % 3 === 0 ? 'hard' : n % 3 === 1 ? 'easy' : 'medium',
      exam: n % 2 === 0 ? 'SSC CGL 2024' : 'SSC CHSL 2024',
      year: 2024,
      shift: (n % 3) + 1,
      quizName: isAi ? 'AI Challenge' : 'PYQ',
      question: `Solve question #${n}: what is ${n} + ${n}?`,
      options: [String(n), String(n * 2), String(n * 3), String(n * 4)],
      correctAnswer: String(n * 2),
      correctLetter: 'b',
      solution: `Because ${n} + ${n} = ${n * 2}.`,
      solutionImage: `https://cdn.example.test/sol_${n}.webp`,
      explanation: `Detailed explanation #${n}`,
      ingestionKey: `ing_key_${n}`,
      battleSelectionKey: `battle_key_${n}`,
      trainingCandidate: { expectedTime: 30 },
      trainingEligible: true,
      translations: {
        bn: {
          question: `প্রশ্ন #${n}: ${n} + ${n} কত?`,
          options: [String(n), String(n * 2), String(n * 3), String(n * 4)],
          solution: `গোপন সমাধান #${n}`,
        },
      },
    };
    return { ...base, ...buildNormalizedQuestionFields(base) };
  });
}

beforeAll(async () => {
  process.env.QUESTIONS_NORMALIZED_KEYS = 'true';
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = `quiz_v1_test_${Date.now()}`;
  db = await connectMongoDB();
  await migrate(db);

  const { app } = await createApp({
    isReady: () => true,
    isShuttingDown: () => false,
    quizOnlyMode: true,
  });
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}, 120_000);

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectMongoDB();
  if (mongo) await mongo.stop();
}, 60_000);

beforeEach(async () => {
  redisState.reset();
  clearSharedLocalCaches();
  invalidateQuestionCacheRevision();
  resetCacheHitSummary();

  await Promise.all([
    db.collection('questions').deleteMany({}),
    db.collection('quizSessions').deleteMany({}),
    db.collection('idempotencyRecords').deleteMany({}),
    db.collection('users').deleteMany({}),
    db.collection('userSessions').deleteMany({}),
  ]);

  await db.collection('users').insertMany([
    { id: 'user_alpha', email: 'alpha@test.local', role: 'user', status: 'active' },
    { id: 'user_beta', email: 'beta@test.local', role: 'user', status: 'active' },
  ]);
  await db.collection('questions').insertMany(makeSeedQuestions(55));

  tokenA = (await createSession({ id: 'user_alpha' })).token;
  tokenB = (await createSession({ id: 'user_beta' })).token;
});

function assertNoSensitiveFields(question) {
  for (const field of SENSITIVE_FIELDS) {
    expect(question[field], `Expected sensitive field "${field}" to be stripped`).toBeUndefined();
  }
  if (question.translations?.bn) {
    expect(question.translations.bn.solution).toBeUndefined();
    expect(question.translations.bn.correctAnswer).toBeUndefined();
    expect(question.translations.bn.question).toBeTruthy();
  }
}

describe('Phase 4 & Phase 6: Standardized /api/v1/quiz/sessions Delivery API', () => {
  it('traverses practice mode via deterministic selectionKey ring-scan with zero duplicates, zero answer leaks, immediate evaluation, and reconnect recovery', async () => {
    const createRes = await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'practice', subject: 'mathematics', batchSize: 20, lang: 'bn' },
      headers: { 'Idempotency-Key': 'create_practice_key_001' },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created).toMatchObject({
      mode: 'practice',
      status: 'in_progress',
      batchSize: 20,
      totalCount: 55,
      answeredCount: 0,
      hasMore: true,
      revision: 0,
    });
    expect(created.sessionId).toMatch(/^qs_/);
    expect(created.questions).toHaveLength(20);
    expect(created.nextCursor).toBeTruthy();
    for (const q of created.questions) assertNoSensitiveFields(q);

    // Traverse remaining batches (20 + 15 = 55 total, zero duplicates)
    const seenUids = new Set(created.questions.map((q) => q.questionUid));
    let cursor = created.nextCursor;
    let batches = 1;
    while (cursor) {
      const batchRes = await api(
        `/api/v1/quiz/sessions/${created.sessionId}/questions?cursor=${encodeURIComponent(cursor)}&batchSize=20`,
      );
      expect(batchRes.status).toBe(200);
      const batch = await batchRes.json();
      batches++;
      expect(batch.batchNumber).toBe(batches);
      expect(batch.returnedCount).toBe(batch.questions.length);
      for (const q of batch.questions) {
        assertNoSensitiveFields(q);
        expect(seenUids.has(q.questionUid)).toBe(false);
        seenUids.add(q.questionUid);
      }
      cursor = batch.nextCursor;
      if (!batch.hasMore) expect(cursor).toBeNull();
    }
    expect(seenUids.size).toBe(55);
    expect(batches).toBe(3);

    // Submit an answer -> practice mode reveals evaluation AFTER durable persistence
    const firstQ = created.questions[0];
    const ansRes = await api(`/api/v1/quiz/sessions/${created.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'ans_practice_001' },
      body: {
        questionUid: firstQ.questionUid,
        answer: 1, // option index 1 is always n*2 (correct)
        timeTakenMs: 4200,
        submissionId: 'ans_practice_001',
      },
    });
    expect(ansRes.status).toBe(200);
    const ansBody = await ansRes.json();
    expect(ansBody).toMatchObject({
      sessionId: created.sessionId,
      questionUid: firstQ.questionUid,
      accepted: true,
      revision: 1,
      answeredCount: 1,
      evaluation: {
        isCorrect: true,
        correct: 1,
        correctIndex: 1,
      },
    });
    expect(ansBody.evaluation.solution).toContain('Because');
    expect(ansBody.evaluation.translations?.bn?.solution).toContain('গোপন সমাধান');

    // Reconnect session recovery via GET /api/v1/quiz/sessions/:id
    const recoverRes = await api(`/api/v1/quiz/sessions/${created.sessionId}`);
    expect(recoverRes.status).toBe(200);
    const recovered = await recoverRes.json();
    expect(recovered).toMatchObject({
      sessionId: created.sessionId,
      mode: 'practice',
      status: 'in_progress',
      answeredCount: 1,
      answeredQuestionUids: [firstQ.questionUid],
      revision: 1,
      hasMore: false,
    });

    // GET /result before submit must reject with 409
    const prematureResult = await api(`/api/v1/quiz/sessions/${created.sessionId}/result`);
    expect(prematureResult.status).toBe(409);

    // Submit session and inspect idempotent re-submit + result review
    const submitRes = await api(`/api/v1/quiz/sessions/${created.sessionId}/submit`, {
      method: 'POST',
      body: { reason: 'manual' },
    });
    expect(submitRes.status).toBe(200);
    const submitBody = await submitRes.json();
    expect(submitBody.status).toBe('completed');
    expect(submitBody.result).toMatchObject({
      totalQuestions: 55,
      attempted: 1,
      correct: 1,
      incorrect: 0,
      skipped: 54,
      accuracy: 100,
      score: 1,
    });

    const repeatSubmit = await api(`/api/v1/quiz/sessions/${created.sessionId}/submit`, {
      method: 'POST',
    });
    expect(repeatSubmit.status).toBe(200);
    expect((await repeatSubmit.json()).idempotent).toBe(true);

    const resultRes = await api(`/api/v1/quiz/sessions/${created.sessionId}/result`);
    expect(resultRes.status).toBe(200);
    const resultBody = await resultRes.json();
    expect(resultBody.status).toBe('completed');
    expect(resultBody.review).toHaveLength(55);
    const reviewedFirst = resultBody.review.find((r) => r.questionUid === firstQ.questionUid);
    expect(reviewedFirst).toMatchObject({
      isCorrect: true,
      correct: 1,
      attempted: true,
    });
    expect(reviewedFirst.solution).toContain('Because');
  });

  it('delivers topic mode from cached revisioned topic pool permuted by session seed with batched hydration and zero duplicates', async () => {
    const createRes = await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'topic', topic: 'algebra', batchSize: 15 },
    });
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    expect(created.totalCount).toBe(45);
    expect(created.questions).toHaveLength(15);
    expect(created.hasMore).toBe(true);

    const collected = new Set(created.questions.map((q) => q.questionUid));
    let cursor = created.nextCursor;
    while (cursor) {
      const res = await api(`/api/v1/quiz/sessions/${created.sessionId}/questions?cursor=${encodeURIComponent(cursor)}&batchSize=15`);
      expect(res.status).toBe(200);
      const batch = await res.json();
      for (const q of batch.questions) {
        assertNoSensitiveFields(q);
        expect(q.topic).toBe('algebra');
        expect(collected.has(q.questionUid)).toBe(false);
        collected.add(q.questionUid);
      }
      cursor = batch.nextCursor;
    }
    expect(collected.size).toBe(45);
  });

  it('supports speed, mock, and ai modes — suppressing answer reveals in mock/speed until submit while revealing in ai', async () => {
    // 1. Mock mode (no answer reveal until submit, negative marking score)
    const mockRes = await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'mock', subject: 'mathematics', totalQuestions: 10, batchSize: 5, timeLimitSec: 1800 },
    });
    expect(mockRes.status).toBe(201);
    const mockSession = await mockRes.json();
    expect(mockSession.totalCount).toBe(10);
    expect(mockSession.questions).toHaveLength(5);
    expect(mockSession.deadlineAt).toBeTruthy();
    for (const q of mockSession.questions) assertNoSensitiveFields(q);

    const mockAns1 = await api(`/api/v1/quiz/sessions/${mockSession.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'mock_ans_0001' },
      body: { questionUid: mockSession.questions[0].questionUid, answer: 1, submissionId: 'mock_ans_0001' },
    });
    expect(mockAns1.status).toBe(200);
    const mockAns1Body = await mockAns1.json();
    expect(mockAns1Body.accepted).toBe(true);
    expect(mockAns1Body.evaluation).toBeUndefined(); // STRICT: never reveal in mock before submit

    const mockAns2 = await api(`/api/v1/quiz/sessions/${mockSession.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'mock_ans_0002' },
      body: { questionUid: mockSession.questions[1].questionUid, answer: 0, submissionId: 'mock_ans_0002' },
    });
    expect(mockAns2.status).toBe(200);
    expect((await mockAns2.json()).evaluation).toBeUndefined();

    // Result blocked before submit
    expect((await api(`/api/v1/quiz/sessions/${mockSession.sessionId}/result`)).status).toBe(409);

    const mockSubmit = await api(`/api/v1/quiz/sessions/${mockSession.sessionId}/submit`, { method: 'POST' });
    expect(mockSubmit.status).toBe(200);
    const mockSubmitBody = await mockSubmit.json();
    // 1 correct (+2) + 1 incorrect (-0.5) = 1.5
    expect(mockSubmitBody.result).toMatchObject({
      totalQuestions: 10,
      attempted: 2,
      correct: 1,
      incorrect: 1,
      skipped: 8,
      score: 1.5,
    });

    const mockResult = await api(`/api/v1/quiz/sessions/${mockSession.sessionId}/result`);
    expect(mockResult.status).toBe(200);
    expect((await mockResult.json()).review).toHaveLength(10);

    // 2. Speed mode (preloaded immutable ordered set + server deadlineAt + no answer reveals)
    const speedRes = await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'speed', subject: 'mathematics', questionCount: 8, batchSize: 8, timeLimitSeconds: 300 },
    });
    expect(speedRes.status).toBe(201);
    const speedSession = await speedRes.json();
    expect(speedSession.totalCount).toBe(8);
    expect(speedSession.questions).toHaveLength(8);
    expect(speedSession.deadlineAt).toBeTruthy();

    const speedAns = await api(`/api/v1/quiz/sessions/${speedSession.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'speed_ans_0001' },
      body: { questionUid: speedSession.questions[0].questionUid, answer: 1, timeTakenSeconds: 4.5, submissionId: 'speed_ans_0001' },
    });
    expect(speedAns.status).toBe(200);
    expect((await speedAns.json()).evaluation).toBeUndefined();

    // 3. AI mode (persisted validated set + immediate evaluation on answer)
    const aiRes = await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'ai', subject: 'mathematics', totalQuestions: 10, batchSize: 10 },
    });
    expect(aiRes.status).toBe(201);
    const aiSession = await aiRes.json();
    expect(aiSession.totalCount).toBe(10);
    expect(aiSession.questions).toHaveLength(10);

    const aiAns = await api(`/api/v1/quiz/sessions/${aiSession.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'ai_ans_00001' },
      body: { questionUid: aiSession.questions[0].questionUid, answer: 1, submissionId: 'ai_ans_00001' },
    });
    expect(aiAns.status).toBe(200);
    expect((await aiAns.json()).evaluation).toMatchObject({ isCorrect: true, correct: 1 });
  });

  it('enforces strict authentication, user ownership (403), and Zod input validation (400)', async () => {
    // Unauthenticated rejected with 401
    expect((await api('/api/v1/quiz/sessions', { method: 'POST', token: null, body: { mode: 'practice' } })).status).toBe(401);

    // Invalid Zod payloads rejected with 400
    expect((await api('/api/v1/quiz/sessions', { method: 'POST', body: { mode: 'invalid-mode' } })).status).toBe(400);
    expect((await api('/api/v1/quiz/sessions', { method: 'POST', body: { mode: 'practice', batchSize: 51 } })).status).toBe(400);
    expect((await api('/api/v1/quiz/sessions', { method: 'POST', body: { mode: 'practice', batchSize: 0 } })).status).toBe(400);
    expect((await api('/api/v1/quiz/sessions', { method: 'POST', body: { mode: 'practice', lang: 'fr' } })).status).toBe(400);

    const created = await (await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'topic', topic: 'algebra', batchSize: 10 },
    })).json();

    // User B cannot read, paginate, answer, submit, or view results of User A's session
    expect((await api(`/api/v1/quiz/sessions/${created.sessionId}`, { token: tokenB })).status).toBe(403);
    expect((await api(`/api/v1/quiz/sessions/${created.sessionId}/questions`, { token: tokenB })).status).toBe(403);
    expect((await api(`/api/v1/quiz/sessions/${created.sessionId}/answers`, {
      method: 'POST',
      token: tokenB,
      headers: { 'Idempotency-Key': 'user_b_attack_key' },
      body: { questionUid: created.questions[0].questionUid, answer: 1, submissionId: 'user_b_attack_key' },
    })).status).toBe(403);
    expect((await api(`/api/v1/quiz/sessions/${created.sessionId}/submit`, { method: 'POST', token: tokenB })).status).toBe(403);
    expect((await api(`/api/v1/quiz/sessions/${created.sessionId}/result`, { token: tokenB })).status).toBe(403);

    // Missing/mismatched Idempotency-Key & tampered cursor rejected with 400
    expect((await api(`/api/v1/quiz/sessions/${created.sessionId}/questions?cursor=tampered.cursor`)).status).toBe(400);
    expect((await api(`/api/v1/quiz/sessions/${created.sessionId}/answers`, {
      method: 'POST',
      body: { questionUid: created.questions[0].questionUid, answer: 1 },
    })).status).toBe(400);
    expect((await api(`/api/v1/quiz/sessions/${created.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idem_key_alpha_1' },
      body: { questionUid: created.questions[0].questionUid, answer: 1, submissionId: 'different_sub_id' },
    })).status).toBe(400);
    expect((await api(`/api/v1/quiz/sessions/${created.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'idem_key_oob_001' },
      body: { questionUid: created.questions[0].questionUid, answer: 9, submissionId: 'idem_key_oob_001' },
    })).status).toBe(400);

    // Nonexistent session returns 404
    expect((await api('/api/v1/quiz/sessions/qs_does_not_exist_1234')).status).toBe(404);
  });

  it('handles concurrent duplicate answer submissions atomically without score inflation (same key AND different keys for same questionUid)', async () => {
    const created = await (await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'practice', subject: 'mathematics', batchSize: 10 },
    })).json();
    const targetUid = created.questions[0].questionUid;

    // 1. 5 parallel identical requests with the SAME Idempotency-Key
    const sameKeyReplies = await Promise.all(
      Array.from({ length: 5 }, () =>
        api(`/api/v1/quiz/sessions/${created.sessionId}/answers`, {
          method: 'POST',
          headers: { 'Idempotency-Key': 'parallel_same_key_01' },
          body: { questionUid: targetUid, answer: 1, submissionId: 'parallel_same_key_01' },
        }),
      ),
    );
    expect(sameKeyReplies.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const sameKeyBodies = await Promise.all(sameKeyReplies.map((r) => r.json()));
    expect(sameKeyBodies.every((b) => b.answeredCount === 1 && b.revision === 1)).toBe(true);

    // Same key with DIFFERENT answer payload must conflict with 409
    const conflictRes = await api(`/api/v1/quiz/sessions/${created.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'parallel_same_key_01' },
      body: { questionUid: targetUid, answer: 0, submissionId: 'parallel_same_key_01' },
    });
    expect(conflictRes.status).toBe(409);

    // 2. Different Idempotency-Keys for the EXACT SAME questionUid concurrently -> zero score inflation
    const diffKeyReplies = await Promise.all(
      ['diff_key_0001', 'diff_key_0002', 'diff_key_0003'].map((key) =>
        api(`/api/v1/quiz/sessions/${created.sessionId}/answers`, {
          method: 'POST',
          headers: { 'Idempotency-Key': key },
          body: { questionUid: targetUid, answer: 1, submissionId: key },
        }),
      ),
    );
    expect(diffKeyReplies.every((r) => r.status === 200)).toBe(true);
    const diffKeyBodies = await Promise.all(diffKeyReplies.map((r) => r.json()));
    expect(diffKeyBodies.every((b) => b.answeredCount === 1 && b.idempotent === true)).toBe(true);

    const submitted = await (await api(`/api/v1/quiz/sessions/${created.sessionId}/submit`, { method: 'POST' })).json();
    expect(submitted.result).toMatchObject({ attempted: 1, correct: 1, score: 1 });
  });

  it('uses Redis cache-aside for warm reads and falls back seamlessly to MongoDB during Redis outages', async () => {
    const created = await (await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'topic', topic: 'algebra', batchSize: 10 },
    })).json();

    // First GET populates L1/Redis session cache
    const read1 = await api(`/api/v1/quiz/sessions/${created.sessionId}`);
    expect(read1.status).toBe(200);
    expect(redisState.getStats().sets).toBeGreaterThan(0);

    // Clear L1 only -> second GET must serve from Redis with 0 MongoDB quizSessions reads!
    clearSharedLocalCaches();
    const findOneSpy = vi.spyOn(Collection.prototype, 'findOne');
    const read2 = await api(`/api/v1/quiz/sessions/${created.sessionId}`);
    expect(read2.status).toBe(200);
    const sessionMongoReads = findOneSpy.mock.instances.filter((c) => c.collectionName === 'quizSessions').length;
    expect(sessionMongoReads).toBe(0);
    findOneSpy.mockRestore();

    // Simulate total Redis outage + cold L1 -> seamlessly falls back to MongoDB!
    redisState.setFailMode(true);
    clearSharedLocalCaches();
    const readDuringOutage = await api(`/api/v1/quiz/sessions/${created.sessionId}`);
    expect(readDuringOutage.status).toBe(200);
    expect((await readDuringOutage.json()).sessionId).toBe(created.sessionId);

    // Batch fetch & answer submit also keep working during Redis outage
    const batchDuringOutage = await api(
      `/api/v1/quiz/sessions/${created.sessionId}/questions?cursor=${encodeURIComponent(created.nextCursor)}&batchSize=10`,
    );
    expect(batchDuringOutage.status).toBe(200);
    expect((await batchDuringOutage.json()).questions).toHaveLength(10);

    redisState.setFailMode(false);
  });

  it('blocks unauthenticated prefetch-reveal, enforces cursor fingerprint & numeric id cursor pagination, sanitizes mock translations/reviews, and exposes health cache stats', async () => {
    // 1. Unauthenticated /api/questions/prefetch-reveal blocked (401); authenticated disabled by default (403)
    const unauth = await api('/api/questions/prefetch-reveal', {
      method: 'POST',
      token: null,
      body: { items: [{ questionUid: `q_${'1'.padStart(32, '0')}` }] },
    });
    expect(unauth.status).toBe(401);

    const authed = await api('/api/questions/prefetch-reveal', {
      method: 'POST',
      body: { items: [{ questionUid: `q_${'1'.padStart(32, '0')}` }] },
    });
    expect(authed.status).toBe(403);

    // 2. /api/questions/session cursor query fingerprint enforcement (rejects filter mismatch & raw ObjectId)
    const s1 = await fetchQuestionsSession({ topic: 'algebra', limit: 10 });
    expect(s1.questions).toHaveLength(10);
    expect(s1.nextCursor).toBeTruthy();
    await expect(
      fetchQuestionsSession({ topic: 'geometry', cursor: s1.nextCursor, limit: 10 }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      fetchQuestionsSession({ topic: 'algebra', cursor: '672000000000000000000001', limit: 10 }),
    ).rejects.toMatchObject({ statusCode: 400 });

    // 3. questionCursorService supports numeric legacy `id` in sorted pagination and blocks raw ObjectId bypass
    const p1 = await fetchQuestionCursorPage({ topic: 'algebra', sort: 'asc', limit: 10 });
    expect(p1.questions).toHaveLength(10);
    expect(typeof p1.questions[0].id).toBe('number');
    const p2 = await fetchQuestionCursorPage({ topic: 'algebra', sort: 'asc', limit: 10, cursor: p1.nextCursor });
    expect(p2.questions).toHaveLength(10);
    expect(p2.questions[0].id).toBeGreaterThan(p1.questions.at(-1).id);
    await expect(
      fetchQuestionCursorPage({ topic: 'algebra', cursor: '672000000000000000000001' }),
    ).rejects.toMatchObject({ statusCode: 400 });

    // 4. mockTestPresentation sanitizes language-keyed dynamic translations & strips internal metadata on review
    const dynamicPaper = {
      sections: [
        {
          key: 'quant',
          questions: [
            {
              id: 'q1',
              question: '2+2?',
              options: ['3', '4'],
              solution: 'Four',
              ingestionKey: 'secret-ing',
              battleSelectionKey: 'secret-battle',
              trainingCandidate: { x: 1 },
              translations: {
                bn: { question: '২+২?', options: ['৩', '৪'], solution: 'গোপন' },
              },
            },
          ],
        },
      ],
    };
    const active = activePaper(dynamicPaper);
    expect(active.sections[0].questions[0].translations).toEqual({
      bn: { question: '২+২?', options: ['৩', '৪'] },
    });
    expect(active.sections[0].questions[0].solution).toBeUndefined();

    const reviewed = reviewPaper(dynamicPaper);
    expect(reviewed.sections[0].questions[0].solution).toBe('Four');
    expect(reviewed.sections[0].questions[0].ingestionKey).toBeUndefined();
    expect(reviewed.sections[0].questions[0].battleSelectionKey).toBeUndefined();
    expect(reviewed.sections[0].questions[0].trainingCandidate).toBeUndefined();

    // 5. /api/health exposes non-blocking redisCacheStats & cacheHitSummary without breaking existing fields
    const healthRes = await api('/api/health', { token: null });
    expect(healthRes.status).toBe(200);
    const health = await healthRes.json();
    expect(health.ok).toBe(true);
    expect(health.redisCacheStats).toMatchObject({ recommendedEvictionPolicy: 'allkeys-lru' });
    expect(health.cacheHitSummary).toHaveProperty('hitRatio');
  });

  it('prevents answer-key AuthZ oracles, makes GET /questions retries idempotent, rejects GET on completed sessions, accepts colon Idempotency-Keys, and rejects array answers on non-MSQ questions', async () => {
    // 1. Colon-delimited Idempotency-Key works consistently on POST /sessions, /answers, and /submit
    const createRes = await api('/api/v1/quiz/sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'sess:1:1:colon_key_01' },
      body: { mode: 'practice', subject: 'mathematics', batchSize: 15 },
    });
    expect(createRes.status).toBe(201);
    const session = await createRes.json();
    expect(session.questions).toHaveLength(15);
    expect(session.nextCursor).toBeTruthy();

    // 2. Idempotent HTTP retry of GET /questions?cursor=X in practice mode returns identical batch & preserves hasMore
    const batch2Attempt1 = await (
      await api(`/api/v1/quiz/sessions/${session.sessionId}/questions?cursor=${encodeURIComponent(session.nextCursor)}&batchSize=15`)
    ).json();
    const batch2Attempt2 = await (
      await api(`/api/v1/quiz/sessions/${session.sessionId}/questions?cursor=${encodeURIComponent(session.nextCursor)}&batchSize=15`)
    ).json();
    expect(batch2Attempt1.questions).toHaveLength(15);
    expect(batch2Attempt2.questions.map((q) => q.questionUid)).toEqual(
      batch2Attempt1.questions.map((q) => q.questionUid),
    );
    expect(batch2Attempt2.hasMore).toBe(true);
    expect(batch2Attempt2.nextCursor).toBe(batch2Attempt1.nextCursor);

    // Also verify idempotent retry in topic mode
    const topicSession = await (
      await api('/api/v1/quiz/sessions', {
        method: 'POST',
        body: { mode: 'topic', topic: 'algebra', batchSize: 15 },
      })
    ).json();
    const topicRetry1 = await (
      await api(`/api/v1/quiz/sessions/${topicSession.sessionId}/questions?cursor=${encodeURIComponent(topicSession.nextCursor)}&batchSize=15`)
    ).json();
    const topicRetry2 = await (
      await api(`/api/v1/quiz/sessions/${topicSession.sessionId}/questions?cursor=${encodeURIComponent(topicSession.nextCursor)}&batchSize=15`)
    ).json();
    expect(topicRetry2.questions.map((q) => q.questionUid)).toEqual(
      topicRetry1.questions.map((q) => q.questionUid),
    );
    expect(topicRetry2.hasMore).toBe(true);

    // 3. AuthZ oracle prevention: User B probing nonexistent questionUid or out-of-range answer gets 403 (never 404/400)
    const oracleOtherUser = await api(`/api/v1/quiz/sessions/${session.sessionId}/answers`, {
      method: 'POST',
      token: tokenB,
      headers: { 'Idempotency-Key': 'oracle:userb:00001' },
      body: { questionUid: 'q_nonexistent_probe_999', answer: 19, submissionId: 'oracle:userb:00001' },
    });
    expect(oracleOtherUser.status).toBe(403);

    const oracleBogusSession = await api('/api/v1/quiz/sessions/qs_bogus_session_0001/answers', {
      method: 'POST',
      token: tokenB,
      headers: { 'Idempotency-Key': 'oracle:bogus:00001' },
      body: { questionUid: session.questions[0].questionUid, answer: 19, submissionId: 'oracle:bogus:00001' },
    });
    expect(oracleBogusSession.status).toBe(404);
    expect((await oracleBogusSession.json()).code).toBe('SESSION_NOT_FOUND');

    // 4. Array answer on non-MSQ question rejects with 400 INVALID_ANSWER_TYPE instead of silent isCorrect: false
    const arrayOnMcq = await api(`/api/v1/quiz/sessions/${session.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'arr:nonmsq:000001' },
      body: { questionUid: session.questions[0].questionUid, answer: [0, 1], submissionId: 'arr:nonmsq:000001' },
    });
    expect(arrayOnMcq.status).toBe(400);
    expect((await arrayOnMcq.json()).code).toBe('INVALID_ANSWER_TYPE');

    // 5. Submit with colon Idempotency-Key, then GET /questions on completed session must return 409
    const submitRes = await api(`/api/v1/quiz/sessions/${session.sessionId}/submit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'sub:1:1:colon_key_01' },
      body: { reason: 'manual' },
    });
    expect(submitRes.status).toBe(200);

    const fetchAfterSubmit = await api(
      `/api/v1/quiz/sessions/${session.sessionId}/questions?cursor=${encodeURIComponent(batch2Attempt1.nextCursor)}`,
    );
    expect(fetchAfterSubmit.status).toBe(409);
    expect((await fetchAfterSubmit.json()).code).toBe('SESSION_NOT_ACTIVE');
  });

  it('delivers and grades legacy documents without persisted questionUid using consistent canonical identity while preserving strict 404 validation', async () => {
    await db.collection('questions').deleteMany({});
    clearSharedLocalCaches();
    invalidateQuestionCacheRevision();

    const stagingDocId = new ObjectId('6a9bf2556b515a22c7f94639');
    const secondLegacyId = new ObjectId();
    const expectedStagingUid = 'q_9bdff06486fe9b21f07585ab75afeec5';
    expect(canonicalQuestionUid({ _id: stagingDocId })).toBe(expectedStagingUid);

    const legacyDocs = [
      {
        _id: stagingDocId,
        id: 'pinn_numbersystem_45',
        subject: 'mathematics',
        topic: 'number-system',
        chapter: 'number-system',
        concept: 'Divisibility',
        difficulty: 'medium',
        exam: 'SSC CPO 09/12/2019 (Evening)',
        quizName: 'PYQ',
        question: 'Which number is divisible by 9?',
        options: ['123', '234', '346', '457'],
        correctAnswer: '234',
        correctLetter: 'b',
        solution: '2 + 3 + 4 = 9, which is divisible by 9.',
      },
      {
        _id: secondLegacyId,
        id: 'pinn_numbersystem_46',
        subject: 'mathematics',
        topic: 'number-system',
        chapter: 'number-system',
        concept: 'Remainders',
        difficulty: 'easy',
        exam: 'SSC CPO 09/12/2019 (Evening)',
        quizName: 'PYQ',
        question: 'What is 17 mod 5?',
        options: ['1', '2', '3', '4'],
        correctAnswer: '2',
        correctLetter: 'b',
        solution: '17 = 3 * 5 + 2.',
      },
    ].map((doc) => ({ ...doc, ...buildNormalizedQuestionFields(doc) }));

    // Explicitly verify these legacy fixtures have NO persisted questionUid.
    for (const doc of legacyDocs) expect(doc.questionUid).toBeUndefined();
    await db.collection('questions').insertMany(legacyDocs);

    // 1. Practice mode: create session -> deliver -> answer -> submit -> review.
    const practiceCreate = await api('/api/v1/quiz/sessions', {
      method: 'POST',
      headers: { 'Idempotency-Key': 'legacy_practice_create_01' },
      body: { mode: 'practice', subject: 'mathematics', topic: 'number-system', batchSize: 10 },
    });
    expect(practiceCreate.status).toBe(201);
    const practiceSession = await practiceCreate.json();
    expect(practiceSession.questions).toHaveLength(2);

    const deliveredStaging = practiceSession.questions.find((q) => q.id === 'pinn_numbersystem_45');
    expect(deliveredStaging).toBeDefined();
    expect(deliveredStaging.questionUid).toBe(expectedStagingUid);
    assertNoSensitiveFields(deliveredStaging);

    // Answer submission using the delivered canonical questionUid succeeds (never 404 QUESTION_NOT_FOUND).
    const practiceAnswer = await api(`/api/v1/quiz/sessions/${practiceSession.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'legacy_practice_ans_01' },
      body: {
        questionUid: deliveredStaging.questionUid,
        answer: 1,
        timeTakenMs: 3100,
        submissionId: 'legacy_practice_ans_01',
      },
    });
    expect(practiceAnswer.status).toBe(200);
    const practiceAnswerBody = await practiceAnswer.json();
    expect(practiceAnswerBody).toMatchObject({
      sessionId: practiceSession.sessionId,
      questionUid: expectedStagingUid,
      accepted: true,
      evaluation: {
        isCorrect: true,
        correct: 1,
        correctIndex: 1,
      },
    });

    // Strict identity validation is NOT weakened:
    // (a) Submitting legacy `id` instead of canonical `questionUid` returns 404 QUESTION_NOT_FOUND.
    const legacyIdAttempt = await api(`/api/v1/quiz/sessions/${practiceSession.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'legacy_id_rejected_01' },
      body: { questionUid: 'pinn_numbersystem_45', answer: 1, submissionId: 'legacy_id_rejected_01' },
    });
    expect(legacyIdAttempt.status).toBe(404);
    expect((await legacyIdAttempt.json()).code).toBe('QUESTION_NOT_FOUND');

    // (b) Submitting an unknown canonical-shaped UID still returns 404 QUESTION_NOT_FOUND.
    const bogusUidAttempt = await api(`/api/v1/quiz/sessions/${practiceSession.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'legacy_bogus_uid_01' },
      body: {
        questionUid: 'q_0000000000000000000000000000dead',
        answer: 1,
        submissionId: 'legacy_bogus_uid_01',
      },
    });
    expect(bogusUidAttempt.status).toBe(404);
    expect((await bogusUidAttempt.json()).code).toBe('QUESTION_NOT_FOUND');

    // Submit & review include the legacy question with full canonical identity.
    const practiceSubmit = await api(`/api/v1/quiz/sessions/${practiceSession.sessionId}/submit`, {
      method: 'POST',
    });
    expect(practiceSubmit.status).toBe(200);
    const practiceResult = await api(`/api/v1/quiz/sessions/${practiceSession.sessionId}/result`);
    expect(practiceResult.status).toBe(200);
    const practiceResultBody = await practiceResult.json();
    expect(practiceResultBody.review).toHaveLength(2);
    expect(practiceResultBody.review.find((r) => r.questionUid === expectedStagingUid)).toMatchObject({
      questionUid: expectedStagingUid,
      attempted: true,
      isCorrect: true,
      correct: 1,
    });

    // 2. Topic mode & Mock mode also hydrate, deliver, and grade legacy docs consistently.
    const topicCreate = await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'topic', subject: 'mathematics', topic: 'number-system', batchSize: 10 },
    });
    expect(topicCreate.status).toBe(201);
    const topicSession = await topicCreate.json();
    expect(topicSession.totalCount).toBe(2);
    expect(topicSession.questions).toHaveLength(2);
    expect(topicSession.questions.some((q) => q.questionUid === expectedStagingUid)).toBe(true);

    const topicAnswer = await api(`/api/v1/quiz/sessions/${topicSession.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'legacy_topic_ans_01' },
      body: { questionUid: expectedStagingUid, answer: 1, submissionId: 'legacy_topic_ans_01' },
    });
    expect(topicAnswer.status).toBe(200);
    expect((await topicAnswer.json()).evaluation).toMatchObject({ isCorrect: true, correct: 1 });

    // 3. After migration 028 backfills questionUid, delivery & answer submission work purely via persisted questionUid.
    await migration028.up(db);
    clearSharedLocalCaches();
    invalidateQuestionCacheRevision();

    const persistedDoc = await db.collection('questions').findOne({ _id: stagingDocId });
    expect(persistedDoc.questionUid).toBe(expectedStagingUid);

    const postBackfillCreate = await api('/api/v1/quiz/sessions', {
      method: 'POST',
      body: { mode: 'practice', subject: 'mathematics', topic: 'number-system', batchSize: 10 },
    });
    expect(postBackfillCreate.status).toBe(201);
    const postBackfillSession = await postBackfillCreate.json();
    expect(postBackfillSession.questions.some((q) => q.questionUid === expectedStagingUid)).toBe(true);

    // Persisted sessions need no legacyQuestionDocIds fallback map.
    const storedSession = await db.collection('quizSessions').findOne({ sessionId: postBackfillSession.sessionId });
    expect(storedSession.legacyQuestionDocIds).toBeUndefined();

    const findOneSpy = vi.spyOn(Collection.prototype, 'findOne');
    const postBackfillAnswer = await api(`/api/v1/quiz/sessions/${postBackfillSession.sessionId}/answers`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'post_backfill_ans_01' },
      body: { questionUid: expectedStagingUid, answer: 1, submissionId: 'post_backfill_ans_01' },
    });
    expect(postBackfillAnswer.status).toBe(200);
    expect((await postBackfillAnswer.json()).evaluation).toMatchObject({ isCorrect: true, correct: 1 });

    // Confirm loadServerAnswerKey uses $type: 'string' so MongoDB uses the partial question_canonical_identity index.
    const answerKeyQueryFilter = findOneSpy.mock.calls.find(
      ([filter]) => filter?.questionUid && typeof filter.questionUid === 'object',
    )?.[0];
    findOneSpy.mockRestore();
    expect(answerKeyQueryFilter).toEqual({
      questionUid: { $eq: expectedStagingUid, $type: 'string' },
    });

    const singlePlan = await db
      .collection('questions')
      .find(answerKeyQueryFilter)
      .limit(1)
      .explain('queryPlanner');
    expect(JSON.stringify(singlePlan.queryPlanner.winningPlan)).toContain('"stage":"IXSCAN"');
    expect(JSON.stringify(singlePlan.queryPlanner.winningPlan)).toContain(
      '"indexName":"question_canonical_identity"',
    );

    const postBackfillSubmit = await api(`/api/v1/quiz/sessions/${postBackfillSession.sessionId}/submit`, {
      method: 'POST',
    });
    expect(postBackfillSubmit.status).toBe(200);

    clearSharedLocalCaches();
    redisState.store.clear();
    const findSpy = vi.spyOn(Collection.prototype, 'find');
    const postBackfillResult = await api(`/api/v1/quiz/sessions/${postBackfillSession.sessionId}/result`);
    expect(postBackfillResult.status).toBe(200);

    const batchKeyQueryFilter = findSpy.mock.calls.find(
      ([filter]) => filter?.questionUid && Array.isArray(filter.questionUid.$in),
    )?.[0];
    findSpy.mockRestore();
    expect(batchKeyQueryFilter).toEqual({
      questionUid: { $in: expect.arrayContaining([expectedStagingUid]), $type: 'string' },
    });

    const batchPlan = await db
      .collection('questions')
      .find(batchKeyQueryFilter)
      .explain('queryPlanner');
    expect(JSON.stringify(batchPlan.queryPlanner.winningPlan)).toContain('"stage":"IXSCAN"');
    expect(JSON.stringify(batchPlan.queryPlanner.winningPlan)).toContain(
      '"indexName":"question_canonical_identity"',
    );
  });

  it('caches practice countDocuments per revision and canonical filter across L1 and Redis, falls back during Redis errors, and invalidates on question change', async () => {
    const countSpy = vi.spyOn(Collection.prototype, 'countDocuments');
    try {
      // 1. Cold call: hits MongoDB countDocuments once and populates L1 + Redis.
      const res1 = await api('/api/v1/quiz/sessions', {
        method: 'POST',
        body: { mode: 'practice', subject: 'mathematics', difficulty: 'mixed', letter: 'b, a', batchSize: 10 },
      });
      expect(res1.status).toBe(201);
      const body1 = await res1.json();
      expect(countSpy).toHaveBeenCalledTimes(1);

      // 2. Warm L1 hit with equivalent canonical filter (difficulty omitted vs 'mixed', letter 'A,B' vs 'b, a'): 0 Mongo countDocuments.
      countSpy.mockClear();
      const res2 = await api('/api/v1/quiz/sessions', {
        method: 'POST',
        body: { mode: 'practice', subject: 'mathematics', letter: 'A,B', batchSize: 10 },
      });
      expect(res2.status).toBe(201);
      expect((await res2.json()).totalCount).toBe(body1.totalCount);
      expect(countSpy).toHaveBeenCalledTimes(0);

      // 3. Clear L1 only -> warm Redis hit: 0 Mongo countDocuments.
      clearSharedLocalCaches();
      const res3 = await api('/api/v1/quiz/sessions', {
        method: 'POST',
        body: { mode: 'practice', subject: 'mathematics', letter: 'a,b', batchSize: 10 },
      });
      expect(res3.status).toBe(201);
      expect((await res3.json()).totalCount).toBe(body1.totalCount);
      expect(countSpy).toHaveBeenCalledTimes(0);

      // 4. Redis outage + cold L1 -> gracefully falls back to MongoDB without failing request.
      clearSharedLocalCaches();
      redisState.setFailMode(true);
      const res4 = await api('/api/v1/quiz/sessions', {
        method: 'POST',
        body: { mode: 'practice', subject: 'mathematics', batchSize: 10 },
      });
      expect(res4.status).toBe(201);
      expect((await res4.json()).totalCount).toBe(55);
      expect(countSpy).toHaveBeenCalledTimes(1);
      redisState.setFailMode(false);

      // 5. Scoped invalidation evicts cached practice count so subsequent request re-queries MongoDB.
      countSpy.mockClear();
      await invalidateQuestionCaches({ subject: 'mathematics', bumpRevision: true });
      const res5 = await api('/api/v1/quiz/sessions', {
        method: 'POST',
        body: { mode: 'practice', subject: 'mathematics', batchSize: 10 },
      });
      expect(res5.status).toBe(201);
      expect((await res5.json()).totalCount).toBe(55);
      expect(countSpy).toHaveBeenCalledTimes(1);
    } finally {
      countSpy.mockRestore();
      redisState.setFailMode(false);
    }
  });
});
