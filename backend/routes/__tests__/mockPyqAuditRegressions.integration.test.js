import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import express from 'express';
import { once } from 'node:events';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createSession } from '../../auth/sessions.js';
import { migrate } from '../../migrations/runner.js';
import { initializeMockCatalogMetadata } from '../../repositories/mockCatalogMetadataRepository.js';
import mockRouter from '../mocktest.js';
import questionRouter from '../questionRoutes.js';
import { uploadFullPaper } from '../../services/mockTestEngine.js';
import { mutateSeparatedHistory, readSeparatedHistory } from '../../repositories/userHistoryRepository.js';
import { modifyQuestion } from '../../services/questions/questionWriteService.js';
import { fetchQuestionsRevealWindow, fetchQuestionsSession } from '../../services/questions/questionSessionService.js';
import { invalidateQuestionCacheRevision } from '../../services/questions/questionCache.js';
import { processUserAnswer } from '../../services/questionService.js';
import { quizCorrectIndex } from '@meow/contracts/questions';

vi.mock('../../services/mockPublicationNotificationService.js', () => ({
  notifyNewMockPublished: vi.fn().mockResolvedValue(undefined),
}));

let mongo, db, server, base, userToken, adminToken;

async function apiFetch(path, { method = 'GET', body, token = userToken, headers = {} } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

beforeAll(async () => {
  process.env.QUESTIONS_NORMALIZED_KEYS = 'true';
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = `audit_regressions_${Date.now()}`;
  db = await connectMongoDB();
  await migrate(db);
  await initializeMockCatalogMetadata(db);

  const app = express();
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/mocktest', mockRouter);
  app.use('/api/questions', questionRouter);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}, 60_000);

afterAll(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectMongoDB();
  if (mongo) await mongo.stop();
}, 30_000);

beforeEach(async () => {
  await Promise.all([
    db.collection('mockSlots').deleteMany({}),
    db.collection('mockAttempts').deleteMany({}),
    db.collection('idempotencyRecords').deleteMany({}),
    db.collection('questions').deleteMany({}),
    db.collection('users').deleteMany({}),
    db.collection('userBookmarks').deleteMany({}),
    db.collection('userQuestionProgress').deleteMany({}),
    db.collection('userTopicProgress').deleteMany({}),
  ]);
  await initializeMockCatalogMetadata(db);
  await db.collection('users').insertMany([
    { id: 'audit-user-1', role: 'user', status: 'active', historyStorageVersion: 1 },
    { id: 'audit-admin-1', role: 'admin', status: 'active' },
  ]);
  userToken = (await createSession({ id: 'audit-user-1' })).token;
  adminToken = (await createSession({ id: 'audit-admin-1' })).token;
  invalidateQuestionCacheRevision();
});

describe('Mock Test Audit Regressions', () => {
  it('rejects __initialized__ sentinel examSlug and empty limit with 400 instead of 500', async () => {
    const sentinel = await apiFetch('/api/mocktest/__initialized__/slots?catalog=1');
    expect(sentinel.status).toBe(400);

    const emptyLimit = await apiFetch('/api/mocktest/ssc-cgl/slots?catalog=1&limit=');
    expect(emptyLimit.status).toBe(400);
  });

  it('enforces server-side deadlineAt on schemaDriven composite-timer papers and preserves answers on partial autosave', async () => {
    const compositePaper = {
      exam: 'SSC_CHSL',
      tier: 1,
      type: 'PYQ',
      examDate: '2025-11-12',
      shift: 2,
      marksPerQuestion: 2,
      negativeMarks: 0.5,
      sections: {
        math: {
          questions: [
            {
              id: 'm1',
              question: { en: '2 + 2 = ?', bn: '২ + ২ = ?' },
              options: { en: ['3', '4', '5', '6'], bn: ['৩', '৪', '৫', '৬'] },
              answer: 'B',
              solution: { en: 'Four', bn: 'চার' },
            },
          ],
        },
      },
    };
    const uploaded = await uploadFullPaper({
      slotData: { id: 'chsl-comp-1', title: 'CHSL Composite Test', isFree: true },
      paper: compositePaper,
      examMode: 'ssc',
    });
    expect(uploaded.slotId).toBe('chsl-comp-1');

    const startRes = await apiFetch('/api/mocktest/ssc-chsl/chsl-comp-1/start', {
      method: 'POST',
      body: { language: 'bn' },
      headers: { 'Idempotency-Key': 'start_key_composite_01' },
    });
    expect(startRes.status).toBe(201);
    const attempt = await startRes.json();
    expect(attempt.deadlineAt).toBeTruthy();
    expect(attempt.timeLeft).toBeGreaterThan(0);
    expect(attempt.language).toBe('bn');

    // Save an answer first
    const save1 = await apiFetch(`/api/mocktest/attempt/${attempt.attemptId}/autosave`, {
      method: 'PATCH',
      body: { answers: { m1: 'B' }, questionStatuses: { m1: 'answered' }, currentSection: 0, currentQuestion: 0, baseRevision: 0, revision: 1 },
    });
    expect(save1.status).toBe(200);
    const save1Data = await save1.json();
    expect(save1Data.timeLeft).toBeGreaterThan(0);

    // Partial navigation-only autosave omitting `answers` must NOT wipe saved answers
    const save2 = await apiFetch(`/api/mocktest/attempt/${attempt.attemptId}/autosave`, {
      method: 'PATCH',
      body: { currentSection: 0, currentQuestion: 0, baseRevision: 1, revision: 2 },
    });
    expect(save2.status).toBe(200);
    const reloaded = await (await apiFetch(`/api/mocktest/attempt/${attempt.attemptId}`)).json();
    expect(reloaded.answers).toEqual({ m1: 'B' });

    // Force expiry past grace window: autosave must return 409 expired: true
    await db.collection('mockAttempts').updateOne(
      { id: attempt.attemptId },
      { $set: { deadlineAt: new Date(Date.now() - 120_000) } },
    );
    const expiredSave = await apiFetch(`/api/mocktest/attempt/${attempt.attemptId}/autosave`, {
      method: 'PATCH',
      body: { answers: { m1: 'C' }, baseRevision: 2, revision: 3 },
    });
    expect(expiredSave.status).toBe(409);
    expect((await expiredSave.json()).expired).toBe(true);
  });

  it('does not cache transient 409 submission conflicts in idempotencyRecords so retries with the same Idempotency-Key succeed', async () => {
    await db.collection('mockSlots').insertOne({
      id: 'idem-slot',
      examSlug: 'ssc-cgl',
      configKey: 'ssc-cgl-tier1',
      title: 'Idempotency Test',
      type: 'mock',
      isFree: true,
      order: 1,
      hasFixedPaper: true,
      questionCount: 1,
      fixedQuestions: [
        { id: 'q1', sectionKey: 'quant', question: '1+1?', options: ['1', '2', '3', '4'], correctAnswer: 'B' },
      ],
    });
    const started = await (await apiFetch('/api/mocktest/ssc-cgl/idem-slot/start', { method: 'POST' })).json();

    // Mark attempt temporarily abandoned to produce a 409 on the first submit attempt
    await db.collection('mockAttempts').updateOne({ id: started.attemptId }, { $set: { status: 'abandoned' } });
    const first = await apiFetch(`/api/mocktest/attempt/${started.attemptId}/submit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'submit_retry_key_1234' },
    });
    expect(first.status).toBe(409);

    // Restore in_progress and retry with the EXACT SAME Idempotency-Key: must succeed with 200!
    await db.collection('mockAttempts').updateOne({ id: started.attemptId }, { $set: { status: 'in_progress' } });
    const second = await apiFetch(`/api/mocktest/attempt/${started.attemptId}/submit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'submit_retry_key_1234' },
    });
    expect(second.status).toBe(200);
    const result = await second.json();
    expect(result.result.totalScore).toBe(0);

    // Subsequent duplicate with same key replays cleanly
    const third = await apiFetch(`/api/mocktest/attempt/${started.attemptId}/submit`, {
      method: 'POST',
      headers: { 'Idempotency-Key': 'submit_retry_key_1234' },
    });
    expect(third.status).toBe(200);
    expect(third.headers.get('idempotency-replayed')).toBe('true');
  });
});

describe('PYQ Finder & Question Bank Audit Regressions', () => {
  it('blocks NoSQL operator injection in prefetch-reveal and invalidates serverRevealCache on question updates', async () => {
    const qDoc = {
      id: 'pyq_sec_1',
      questionUid: 'q_00000000000000000000000000000001',
      subject: 'mathematics',
      subjectKey: 'mathematics',
      topic: 'percentages',
      topicKey: 'percentages',
      modeKey: 'quiz',
      exam: 'SSC CGL 2024',
      concept: 'Basic Formula',
      year: 2024,
      shift: 2,
      examDate: '2024-09-10',
      question: 'What is 10% of 200?',
      options: ['10', '20', '30', '40'],
      correctAnswer: '20',
      solution: 'Initial solution',
      translations: {
        bn: {
          question: '২০০ এর ১০% কত?',
          options: ['১০', '২০', '৩০', '৪০'],
          solution: 'প্রাথমিক সমাধান',
        },
      },
    };
    const { insertedId } = await db.collection('questions').insertOne(qDoc);

    // Unauthenticated HTTP POST /api/questions/prefetch-reveal is blocked with 401;
    // authenticated requests are disabled by default (403) unless ALLOW_QUESTION_PREFETCH_REVEAL=true.
    const unauthReveal = await apiFetch('/api/questions/prefetch-reveal', {
      method: 'POST',
      token: null,
      body: { items: [{ clientKey: 'k1', sessionAnchor: String(insertedId), questionUid: qDoc.questionUid }] },
    });
    expect(unauthReveal.status).toBe(401);

    const disabledReveal = await apiFetch('/api/questions/prefetch-reveal', {
      method: 'POST',
      body: { items: [{ clientKey: 'k1', sessionAnchor: String(insertedId), questionUid: qDoc.questionUid }] },
    });
    expect(disabledReveal.status).toBe(403);
    expect(await disabledReveal.json()).toEqual({
      error: 'Answer prefetch is disabled. Submit an answer to view the solution.',
    });

    // Attempt NoSQL operator injection in item.id — must return empty reveals, never dump records
    const injected = await fetchQuestionsRevealWindow([{ clientKey: 'hack', id: { $ne: null } }]);
    expect(injected.reveals).toEqual({});

    // Legitimate reveal works and populates serverRevealCache
    const valid = await fetchQuestionsRevealWindow([{ clientKey: 'k1', sessionAnchor: String(insertedId), questionUid: qDoc.questionUid }]);
    expect(valid.reveals.k1.correct).toBe(1);
    expect(valid.reveals.k1.solution).toBe('Initial solution');

    // Update only Bengali question text via modifyQuestion: must preserve bn.options & bn.solution, set updatedAt, and refresh reveal cache
    const updated = await modifyQuestion(qDoc.questionUid, {
      solution: 'Updated solution',
      translations: { bn: { question: '২০০-এর ১০% কত?' } },
      ingestionKey: 'malicious-overwrite',
    });
    expect(updated.translations.bn.question).toBe('২০০-এর ১০% কত?');
    expect(updated.translations.bn.options).toEqual(['১০', '২০', '৩০', '৪০']);
    expect(updated.translations.bn.solution).toBe('প্রাথমিক সমাধান');
    expect(updated.updatedAt).toBeTruthy();
    expect(updated.ingestionKey).toBeUndefined();

    invalidateQuestionCacheRevision();
    const afterUpdate = await fetchQuestionsRevealWindow([{ clientKey: 'k1', sessionAnchor: String(insertedId), questionUid: qDoc.questionUid }]);
    expect(afterUpdate.reveals.k1.solution).toBe('Updated solution');
  });

  it('matches case-insensitive exam/concept and year/shift/examDate filters when QUESTIONS_NORMALIZED_KEYS=true', async () => {
    await db.collection('questions').insertMany([
      {
        id: 'f1',
        questionUid: 'q_00000000000000000000000000000011',
        subject: 'mathematics',
        subjectKey: 'mathematics',
        topic: 'percentages',
        topicKey: 'percentages',
        modeKey: 'quiz',
        exam: 'SSC CGL 2024',
        concept: 'Successive Change',
        year: 2024,
        shift: 3,
        examDate: '2024-09-12',
        question: 'Match me',
        options: ['1', '2', '3', '4'],
        correctAnswer: '2',
      },
      {
        id: 'f2',
        questionUid: 'q_00000000000000000000000000000012',
        subject: 'mathematics',
        subjectKey: 'mathematics',
        topic: 'percentages',
        topicKey: 'percentages',
        modeKey: 'quiz',
        exam: 'SSC CHSL 2023',
        concept: 'Ratio Method',
        year: 2023,
        shift: 1,
        examDate: '2023-08-05',
        question: 'Exclude me',
        options: ['1', '2', '3', '4'],
        correctAnswer: '1',
      },
    ]);

    const res = await fetchQuestionsSession({
      topic: 'percentages',
      exam: 'ssc cgl 2024', // lowercased like /api/questions/meta returns
      concept: 'successive change',
      year: '2024',
      shift: '3',
      examDate: '2024-09-12',
    });
    expect(res.questions).toHaveLength(1);
    expect(res.questions[0].id).toBe('f1');
    expect(res.questions[0].shift).toBe(3);
    expect(res.questions[0].examDate).toBe('2024-09-12');
  });

  it('persists separated bookmarks by questionId without wiping existing bookmarks for historyStorageVersion=1 users', async () => {
    await mutateSeparatedHistory('audit-user-1', 'bookmarkEntries', (rows) => [
      { questionId: 'q_first', title: 'First Q', updatedAt: new Date().toISOString() },
      ...rows,
    ]);
    await mutateSeparatedHistory('audit-user-1', 'bookmarkEntries', (rows) => [
      { questionId: 'q_second', title: 'Second Q', updatedAt: new Date().toISOString() },
      ...rows,
    ]);
    const saved = await readSeparatedHistory(db, 'audit-user-1', 'bookmarkEntries');
    expect(saved.map((r) => r.questionId).sort()).toEqual(['q_first', 'q_second']);
  });

  it('grades single-letter options accurately and supports image_mcq in processUserAnswer', async () => {
    expect(quizCorrectIndex({ correctAnswer: 'A' }, ['B', 'C', 'A', 'D'])).toBe(2);
    expect(quizCorrectIndex({ correctAnswer: 'B' }, ['10', '20', '30', '40'])).toBe(1);

    await db.collection('questions').insertOne({
      id: 'img_q1',
      questionUid: 'q_00000000000000000000000000000099',
      questionType: 'image_mcq',
      topic: 'geometry',
      correctLetter: 'c',
      optionRegions: { a: {}, b: {}, c: {}, d: {} },
    });
    const res = await processUserAnswer('audit-user-1', 'q_00000000000000000000000000000099', 2, 'sub_12345678');
    expect(res).toMatchObject({ isCorrect: true, isFirstTime: true, becameMastered: true });
    expect(adminToken).toBeTruthy();
  });
});
