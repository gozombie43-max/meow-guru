import express from 'express';
import { once } from 'node:events';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { mutateUserBookmarks } from '../../repositories/userRepository.js';
import { uploadImageQuestion } from '../../controllers/imageQuestionController.js';

vi.mock('../../config/b2.js', () => ({
  B2_BUCKET: 'test-bucket',
  b2Client: { send: vi.fn().mockResolvedValue({}) },
}));

describe('M1 Route Error Handling, Atomic Bookmarks, Validation & AI Prompt Delimiters', () => {
  let mongo;
  let db;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    vi.stubEnv('MONGODB_URI', mongo.getUri());
    vi.stubEnv('MONGODB_DB', 'm1_route_hardening_tests');
    db = await connectMongoDB();
  }, 60_000);

  beforeEach(async () => {
    await Promise.all(
      ['users', 'userBookmarks', 'questions', 'idempotencyRecords'].map((name) =>
        db.collection(name).deleteMany({}),
      ),
    );
  });

  afterAll(async () => {
    await disconnectMongoDB();
    await mongo?.stop();
    vi.unstubAllEnvs();
  });

  it('updates bookmarks and bookmarkEntries atomically in a single repository operation for both separated and legacy users', async () => {
    await db.collection('users').insertMany([
      { id: 'sep-user', historyStorageVersion: 1, bookmarks: [] },
      { id: 'leg-user', bookmarks: [], bookmarkEntries: [] },
    ]);

    for (const userId of ['sep-user', 'leg-user']) {
      const res1 = await mutateUserBookmarks(userId, (entries) => [
        { questionId: 'q_1', questionUid: 'q_1', updatedAt: '2026-11-22T10:00:00.000Z' },
        ...entries,
      ]);
      expect(res1.bookmarks).toEqual(['q_1']);
      expect(res1.bookmarkEntries).toHaveLength(1);

      const res2 = await mutateUserBookmarks(userId, (entries) => [
        { questionId: 'q_2', questionUid: 'q_2', updatedAt: '2026-11-22T10:01:00.000Z' },
        ...entries,
      ]);
      expect(res2.bookmarks).toEqual(['q_2', 'q_1']);

      const userDoc = await db.collection('users').findOne({ id: userId });
      expect(userDoc.bookmarks).toEqual(['q_2', 'q_1']);
      expect(userDoc.bookmarkEntriesRevision).toBe(2);
    }
  });

  it('returns 400 instead of 500 when optionRegions JSON is malformed in uploadImageQuestion', async () => {
    const sharp = (await import('sharp')).default;
    const validBuffer = await sharp({
      create: { width: 10, height: 10, channels: 3, background: '#123456' },
    })
      .png()
      .toBuffer();

    const req = {
      files: { questionImage: [{ buffer: validBuffer }] },
      body: {
        topic: 'visual_reasoning',
        correctLetter: 'a',
        optionRegions: '{not-valid-json',
      },
      query: {},
    };
    const res = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.payload = body;
        return this;
      },
    };

    await uploadImageQuestion(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.payload).toEqual({ error: 'Invalid optionRegions JSON' });
  });

  it('forwards non-Multer errors in questionRoutes to centralized errorHandler instead of leaking 400 err.message', async () => {
    vi.resetModules();
    vi.doMock('../../controllers/questionController.js', () => ({
      default: {
        bulkCreateQuestions: (_req, _res, next) => next(new Error('Database connection pool exhausted')),
        exportQuestions: (_req, res) => res.json({}),
        bulkDeleteQuestions: (_req, res) => res.json({}),
        checkDuplicates: (_req, res) => res.json({}),
        getQuestionCounts: (_req, res) => res.json({}),
        generatePracticeTest: (_req, res) => res.json({}),
        runAnalysis: (_req, res) => res.json({}),
        getImageQuestions: (_req, res) => res.json({}),
        getQuestionsSession: (_req, res) => res.json({}),
        prefetchQuestionsReveal: (_req, res) => res.json({}),
        getQuestionsMeta: (_req, res) => res.json({}),
        addQuestion: (_req, res) => res.json({}),
        getQuestions: (_req, res) => res.json({}),
        submitAnswer: (_req, res) => res.json({}),
        getQuestionById: (_req, res) => res.json({}),
        updateQuestion: (_req, res) => res.json({}),
        deleteQuestion: (_req, res) => res.json({}),
      },
    }));
    vi.doMock('../../middleware/auth.js', () => ({
      default: (_req, _res, next) => next(),
    }));

    const questionRouter = (await import('../questionRoutes.js')).default;
    const app = express();
    app.use(express.json());
    app.use('/api/questions', questionRouter);
    app.use(errorHandler);
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const res = await fetch(`${baseUrl}/api/questions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'Internal server error' });
    } finally {
      process.env.NODE_ENV = prevEnv;
      await new Promise((r) => server.close(r));
      vi.doUnmock('../../controllers/questionController.js');
      vi.doUnmock('../../middleware/auth.js');
    }
  });
});
