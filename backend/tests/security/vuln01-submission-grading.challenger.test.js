// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { once } from 'node:events';

// In-memory collections store for empirical grading test
const collections = {
  questions: new Map(),
  idempotencyRecords: new Map(),
  users: new Map(),
  userQuestionProgress: new Map(),
  userTopicProgress: new Map(),
  mockSlots: new Map(),
  runtimeCacheRevisions: new Map(),
};

function createCollectionMock(name) {
  const store = collections[name] || new Map();
  return {
    find: (filter = {}, options = {}) => {
      let rows = Array.from(store.values());
      if (filter.id && filter.id.$in) {
        rows = rows.filter(r => filter.id.$in.includes(r.id) || filter.id.$in.includes(String(r.id)));
      } else if (filter.id) {
        rows = rows.filter(r => r.id === filter.id);
      }
      if (filter.topic) {
        rows = rows.filter(r => r.topic === filter.topic);
      }
      if (filter.questionType) {
        rows = rows.filter(r => r.questionType === filter.questionType);
      }
      const cursor = {
        project: () => cursor,
        sort: () => cursor,
        skip: () => cursor,
        limit: (n) => {
          rows = rows.slice(0, n);
          return cursor;
        },
        collation: () => cursor,
        toArray: async () => rows,
      };
      return cursor;
    },
    findOne: async (filter = {}) => {
      for (const item of store.values()) {
        if (filter._id && String(item._id) === String(filter._id)) return item;
        if (filter.id && item.id === filter.id) return item;
        if (filter.questionUid && item.questionUid === filter.questionUid) return item;
        if (filter.userId && item.userId === filter.userId) return item;
      }
      return null;
    },
    insertOne: async (doc) => {
      const id = doc._id || doc.id || String(store.size + 1);
      const stored = { ...doc, _id: id };
      store.set(String(id), stored);
      return { insertedId: id, acknowledged: true };
    },
    updateOne: async (filter, update) => {
      let target = null;
      for (const item of store.values()) {
        if (filter._id && String(item._id) === String(filter._id)) target = item;
        else if (filter.userId && item.userId === filter.userId && filter.topic && item.topic === filter.topic) target = item;
        else if (filter.userId && item.userId === filter.userId && filter.questionUid && item.questionUid === filter.questionUid) target = item;
      }
      if (target) {
        if (update.$set) Object.assign(target, update.$set);
        if (update.$inc) {
          for (const [k, v] of Object.entries(update.$inc)) {
            target[k] = (target[k] || 0) + v;
          }
        }
        return { matchedCount: 1, modifiedCount: 1 };
      }
      if (update.$set) {
        const id = filter._id || String(store.size + 1);
        store.set(String(id), { ...filter, ...update.$set, _id: id });
        return { matchedCount: 0, upsertedCount: 1 };
      }
      return { matchedCount: 0, modifiedCount: 0 };
    },
    aggregate: (pipeline = []) => {
      let rows = Array.from(store.values());
      const match = pipeline.find(stage => stage.$match)?.$match;
      if (match) {
        if (match.id) rows = rows.filter(r => r.id === match.id);
      }
      return {
        next: async () => rows[0] || null,
        toArray: async () => rows,
      };
    },
    countDocuments: async () => store.size,
  };
}

vi.mock('../../config/mongodb.js', () => ({
  getQuestionsCollection: () => createCollectionMock('questions'),
  getMockSlotsCollection: () => createCollectionMock('mockSlots'),
  getUserTopicProgressCollection: () => createCollectionMock('userTopicProgress'),
  getMongoDB: () => ({
    collection: (name) => createCollectionMock(name),
  }),
  withMongoTransaction: vi.fn(async (cb) => {
    return cb({
      db: { collection: (name) => createCollectionMock(name) },
      session: {},
    });
  }),
}));

vi.mock('../../services/questions/questionMetadataCache.js', () => ({
  invalidateQuestionMetadata: vi.fn(),
  readQuestionMetadata: (_params, build) => build(),
}));

vi.mock('../../middleware/auth.js', () => ({
  default: (_req, _res, next) => next(),
  adminAuth: (_req, _res, next) => next(),
}));

vi.mock('../../middleware/protect.js', () => ({
  protect: (req, _res, next) => {
    req.user = { id: 'student_tester_42', role: 'student' };
    next();
  },
}));

vi.mock('../../repositories/userHistoryRepository.js', () => ({
  persistQuizResume: vi.fn(async (_db, _session, _owner, _resume) => null),
}));

vi.mock('../../services/questions/topicProgressCache.js', () => ({
  invalidateTopicProgress: vi.fn(async () => {}),
  advanceTopicProgressRevision: vi.fn(async () => {}),
}));

import questionRoutes from '../../routes/questionRoutes.js';
import mocktestRoutes from '../../routes/mocktest.js';

const INGESTION_AND_SOLUTION_FIELDS = [
  'correctAnswer',
  'correctLetter',
  'correctIndex',
  'solution',
  'solutionImage',
  'solutionImageWidth',
  'solutionImageHeight',
  'solutionText',
  'explanation',
  'ingestionKey',
  'ingestionHash',
  'battleSelectionKey',
  'trainingCandidate',
  'trainingEligible',
  'trainingMetadataVersion',
  'trainingExamSlugs',
  'trainingSubjectSlug',
  'trainingTopicSlug',
];

const mockRawQuestion = {
  _id: '672000000000000000000777',
  id: 'q_algebra_grading_01',
  questionUid: 'q_77777777777777777777777777777777',
  subject: 'mathematics',
  topic: 'algebra',
  chapter: 'linear-equations',
  concept: 'Variables',
  difficulty: 'medium',
  question: 'Solve for x: 5x - 15 = 0?',
  options: ['x = 1', 'x = 2', 'x = 3', 'x = 4'],
  // ── Sensitive ground truth (index 2 corresponds to 'x = 3') ──
  correctAnswer: 'x = 3',
  correctLetter: 'c',
  solution: '5x = 15 => x = 3.',
  solutionImage: 'https://cdn.meowguru.test/solutions/algebra_grading_01.png',
  solutionImageWidth: 800,
  solutionImageHeight: 600,
  ingestionKey: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  ingestionHash: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  battleSelectionKey: 'cccccccccccccccccccccccc',
  trainingCandidate: { legacyId: 'legacy_grading_01', expectedTime: 30, discrimination: 1.8 },
  trainingEligible: true,
  trainingMetadataVersion: 3,
  trainingExamSlugs: ['ssc-cgl'],
  trainingSubjectSlug: 'mathematics',
  trainingTopicSlug: 'algebra',
  source: 'pyq_exam_bank',
  quizId: 'batch_grading_01',
  translations: {
    bn: {
      question: 'বাংলা প্রশ্ন: 5x - 15 = 0?',
      options: ['x = ১', 'x = ২', 'x = ৩', 'x = ৪'],
      solution: 'গোপন সমাধান: x = ৩',
      solutionImage: 'https://cdn.meowguru.test/bn_secret.png',
    },
  },
};

const mockUser = {
  _id: 'user_mongo_id_42',
  id: 'student_tester_42',
  type: 'student',
  historyStorageVersion: 0,
  progress: {},
  recentQuizzesRevision: 0,
};

describe('EMPIRICAL CHALLENGER: VULN-01 Ingestion Hashes, Solutions & Exam Submission Boundaries', () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/questions', questionRoutes);
    app.use('/api/mocktest', mocktestRoutes);
    app.use((err, _req, res, _next) => {
      res.status(err.statusCode || 500).json({ error: err.message });
    });

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    for (const key of Object.keys(collections)) {
      collections[key].clear();
    }
    // Populate ground truth records
    collections.questions.set(mockRawQuestion.id, { ...mockRawQuestion });
    collections.users.set(mockUser.id, { ...mockUser });
  });

  // ──────────────────────────────────────────────────────────
  // TASK 1: Empirically verify 100% blocking on unauthenticated endpoints
  // ──────────────────────────────────────────────────────────
  describe('Task 1: Ingestion Hashes & Solutions 100% Blocked on Public Endpoints', () => {
    it('blocks all ingestion hashes and solutions on GET /api/questions', async () => {
      const res = await fetch(`${baseUrl}/api/questions?topic=algebra`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questions).toHaveLength(1);
      const q = data.questions[0];

      expect(q.id).toBe(mockRawQuestion.id);
      expect(q.question).toBe(mockRawQuestion.question);
      expect(q.options).toEqual(mockRawQuestion.options);

      for (const field of INGESTION_AND_SOLUTION_FIELDS) {
        expect(q[field], `Public GET /api/questions must not expose ${field}`).toBeUndefined();
      }
      expect(q.translations?.bn?.solution, 'translations.bn.solution must be purged').toBeUndefined();
      expect(q.translations?.bn?.solutionImage, 'translations.bn.solutionImage must be purged').toBeUndefined();
      expect(q.translations?.bn?.question).toBe('বাংলা প্রশ্ন: 5x - 15 = 0?');
    });

    it('blocks all ingestion hashes and solutions on GET /api/questions?pagination=cursor', async () => {
      const res = await fetch(`${baseUrl}/api/questions?pagination=cursor&topic=algebra`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questions).toHaveLength(1);
      const q = data.questions[0];

      for (const field of INGESTION_AND_SOLUTION_FIELDS) {
        expect(q[field], `Cursor pagination must not expose ${field}`).toBeUndefined();
      }
    });

    it('blocks all ingestion hashes and solutions on GET /api/questions/:id', async () => {
      const res = await fetch(`${baseUrl}/api/questions/${mockRawQuestion.id}`);
      expect(res.status).toBe(200);
      const q = await res.json();

      expect(q.id).toBe(mockRawQuestion.id);
      for (const field of INGESTION_AND_SOLUTION_FIELDS) {
        expect(q[field], `GET /:id must not expose ${field}`).toBeUndefined();
      }
      expect(q.translations?.bn?.solution).toBeUndefined();
    });

    it('blocks all ingestion hashes and solutions on GET /api/questions/session', async () => {
      const res = await fetch(`${baseUrl}/api/questions/session?topic=algebra`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questions).toHaveLength(1);
      const q = data.questions[0];

      expect(q.id).toBe(mockRawQuestion.id);
      expect(q.sessionAnchor).toBe(mockRawQuestion._id);
      for (const field of INGESTION_AND_SOLUTION_FIELDS) {
        expect(q[field], `GET /session must not expose ${field}`).toBeUndefined();
      }
      expect(q.translations?.bn?.solution).toBeUndefined();
    });

    it('blocks all ingestion hashes and solutions on POST /api/questions/session', async () => {
      const res = await fetch(`${baseUrl}/api/questions/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'algebra', limit: 10 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questions).toHaveLength(1);
      const q = data.questions[0];

      expect(q.id).toBe(mockRawQuestion.id);
      for (const field of INGESTION_AND_SOLUTION_FIELDS) {
        expect(q[field], `POST /session must not expose ${field}`).toBeUndefined();
      }
    });

    it('blocks all ingestion hashes and solutions on GET /api/questions/image', async () => {
      collections.questions.set('q_img_01', {
        ...mockRawQuestion,
        id: 'q_img_01',
        questionType: 'image_mcq',
      });

      const res = await fetch(`${baseUrl}/api/questions/image?topic=algebra`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questions).toHaveLength(1);
      const q = data.questions[0];

      expect(q.id).toBe('q_img_01');
      for (const field of INGESTION_AND_SOLUTION_FIELDS) {
        expect(q[field], `GET /image must not expose ${field}`).toBeUndefined();
      }
    });

    it('blocks all ingestion hashes and solutions on GET /api/questions/practice-test', async () => {
      const res = await fetch(`${baseUrl}/api/questions/practice-test?subject=mathematics`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questions).toHaveLength(1);
      const q = data.questions[0];

      expect(q.id).toBe(mockRawQuestion.id);
      for (const field of INGESTION_AND_SOLUTION_FIELDS) {
        expect(q[field], `GET /practice-test must not expose ${field}`).toBeUndefined();
      }
    });
  });

  // ──────────────────────────────────────────────────────────
  // TASK 2: Privileged export and review workflows
  // ──────────────────────────────────────────────────────────
  describe('Task 2: Privileged Export & Review Maintain Full Access', () => {
    it('privileged export (GET /api/questions/export) retains all metadata, solutions, and keys in NDJSON', async () => {
      const res = await fetch(`${baseUrl}/api/questions/export?topic=algebra`);
      expect(res.status).toBe(200);
      const text = await res.text();
      const rows = text.trim().split('\n').map(l => JSON.parse(l));
      expect(rows).toHaveLength(1);
      const row = rows[0];

      expect(row.id).toBe(mockRawQuestion.id);
      expect(row.correctAnswer).toBe('x = 3');
      expect(row.correctLetter).toBe('c');
      expect(row.solution).toBe('5x = 15 => x = 3.');
      expect(row.solutionImage).toBe('https://cdn.meowguru.test/solutions/algebra_grading_01.png');
      expect(row.ingestionKey).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
      expect(row.ingestionHash).toBe('bbbbbbbbbbbbbbbbbbbbbbbb');
      expect(row.battleSelectionKey).toBe('cccccccccccccccccccccccc');
      expect(row.trainingCandidate).toEqual({ legacyId: 'legacy_grading_01', expectedTime: 30, discrimination: 1.8 });
      expect(row.trainingEligible).toBe(true);
      expect(row.translations.bn.solution).toBe('গোপন সমাধান: x = ৩');
    });

    it('privileged export with format=json retains all metadata and solutions', async () => {
      const res = await fetch(`${baseUrl}/api/questions/export?topic=algebra&format=json`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.questions).toHaveLength(1);
      const row = data.questions[0];

      expect(row.correctAnswer).toBe('x = 3');
      expect(row.solution).toBe('5x = 15 => x = 3.');
      expect(row.ingestionKey).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
    });

    it('review workflow (adminGetPaperQuestions) retains solutions, answer keys, and translations', async () => {
      collections.mockSlots.set('slot_priv_01', {
        id: 'slot_priv_01',
        examSlug: 'ssc-cgl',
        title: 'Review Paper 01',
        updatedAt: '2026-11-07T12:00:00.000Z',
        fixedQuestions: [
          {
            id: 'q_paper_grading',
            sectionKey: 'math',
            questionType: 'MCQ',
            question: 'What is 5x - 15 = 0?',
            options: ['x = 1', 'x = 2', 'x = 3', 'x = 4'],
            correctAnswer: 'x = 3',
            solution: '5x = 15 => x = 3.',
            image: null,
          },
        ],
      });

      const res = await fetch(`${baseUrl}/api/mocktest/admin/slots/slot_priv_01/questions?examSlug=ssc-cgl&examMode=ssc`);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.title).toBe('Review Paper 01');
      expect(data.questions).toHaveLength(1);
      const q = data.questions[0];

      expect(q.correctAnswer).toBe(2); // Option index 2 corresponds to 'x = 3'
      expect(q.solution).toBe('5x = 15 => x = 3.');
    });
  });

  // ──────────────────────────────────────────────────────────
  // TASK 3: Student Exam Submission & Grading Accuracy
  // ──────────────────────────────────────────────────────────
  describe('Task 3: Student Exam Submission Grading Accuracy', () => {
    describe('POST /api/questions/:id/answer (submitAnswer -> processUserAnswer)', () => {
      it('grades accurately when student submits correct answer for string correctAnswer', async () => {
        // Correct option is index 2 ('x = 3')
        const res = await fetch(`${baseUrl}/api/questions/${mockRawQuestion.id}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            answer: 2,
            topic: 'algebra',
            submissionId: 'sub_test_correct_01',
          }),
        });

        expect(res.status).toBe(200);
        const result = await res.json();
        expect(result.isCorrect).toBe(true);
        expect(result.isFirstTime).toBe(true);
        expect(result.becameMastered).toBe(true);
      });

      it('grades accurately when student submits wrong answer for string correctAnswer', async () => {
        // Wrong option: index 0 ('x = 1')
        const res = await fetch(`${baseUrl}/api/questions/${mockRawQuestion.id}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            answer: 0,
            topic: 'algebra',
            submissionId: 'sub_test_wrong_01',
          }),
        });

        expect(res.status).toBe(200);
        const result = await res.json();
        expect(result.isCorrect).toBe(false);
        expect(result.isFirstTime).toBe(true);
        expect(result.becameMastered).toBe(false);
      });

      it('grades accurately when question uses numeric correctAnswer index', async () => {
        const numericQuestion = {
          ...mockRawQuestion,
          id: 'q_numeric_answer_01',
          questionUid: 'q_88888888888888888888888888888888',
          correctAnswer: 3, // index 3
        };
        collections.questions.set(numericQuestion.id, numericQuestion);

        const res = await fetch(`${baseUrl}/api/questions/${numericQuestion.id}/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answer: 3,
            topic: 'algebra',
            submissionId: 'sub_num_01',
          }),
        });

        expect(res.status).toBe(200);
        const result = await res.json();
        expect(result.isCorrect).toBe(true);
      });

      it('returns 404 if question does not exist', async () => {
        const res = await fetch(`${baseUrl}/api/questions/q_nonexistent_999/answer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            answer: 1,
            topic: 'algebra',
            submissionId: 'sub_404_01',
          }),
        });

        expect(res.status).toBe(404);
        const body = await res.json();
        expect(body.error).toContain('Question not found');
      });
    });

    describe('POST /api/questions/answer (submitQuizAnswer)', () => {
      it('grades accurately with isCorrect: true when student submits the correct option index', async () => {
        const submissionId = 'sub_quiz_grading_correct_1';
        const res = await fetch(`${baseUrl}/api/questions/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': submissionId,
          },
          body: JSON.stringify({
            questionId: mockRawQuestion.id,
            questionUid: mockRawQuestion.questionUid,
            questionIndex: 0,
            answer: 2, // Index 2 is 'x = 3' (correct)
            timeTaken: 12,
            submissionId,
            resume: {
              quizKey: 'aaaa',
              title: 'Algebra Quiz',
              subject: 'mathematics',
              href: '/quiz/algebra',
              selectedAnswers: {},
              submittedQuestions: [],
              removedAnswers: [],
              results: [],
            },
          }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.isCorrect).toBe(true);
        expect(body.correct).toBe(2);
        expect(body.concept).toBe('Variables');
        expect(body.submissionId).toBe(submissionId);
        expect(body.resumeSaved).toBe(true);
      });

      it('grades accurately with isCorrect: false when student submits an incorrect option index', async () => {
        const submissionId = 'sub_quiz_grading_wrong_1';
        const res = await fetch(`${baseUrl}/api/questions/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': submissionId,
          },
          body: JSON.stringify({
            questionId: mockRawQuestion.id,
            questionUid: mockRawQuestion.questionUid,
            questionIndex: 0,
            answer: 1, // Index 1 is 'x = 2' (wrong)
            timeTaken: 15,
            submissionId,
            resume: {
              quizKey: 'aaaa',
              title: 'Algebra Quiz',
              subject: 'mathematics',
              href: '/quiz/algebra',
              selectedAnswers: {},
              submittedQuestions: [],
              removedAnswers: [],
              results: [],
            },
          }),
        });

        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.isCorrect).toBe(false);
        expect(body.correct).toBe(2);
      });

      it('safely replays cached response when matching idempotency record exists', async () => {
        const submissionId = 'sub_quiz_replay_01';
        const payload = {
          questionId: mockRawQuestion.id,
          questionUid: mockRawQuestion.questionUid,
          questionIndex: 0,
          answer: 2,
          timeTaken: 8,
          submissionId,
          resume: {
            quizKey: 'aaaa',
            title: 'Algebra Quiz',
            subject: 'mathematics',
            href: '/quiz/algebra',
            selectedAnswers: {},
            submittedQuestions: [],
            removedAnswers: [],
            results: [],
          },
        };

        // First attempt
        const res1 = await fetch(`${baseUrl}/api/questions/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': submissionId,
          },
          body: JSON.stringify(payload),
        });
        expect(res1.status).toBe(200);
        const body1 = await res1.json();

        // Replay attempt with same key and payload
        const res2 = await fetch(`${baseUrl}/api/questions/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': submissionId,
          },
          body: JSON.stringify(payload),
        });
        expect(res2.status).toBe(200);
        expect(res2.headers.get('Idempotency-Replayed')).toBe('true');
        const body2 = await res2.json();
        expect(body2).toEqual(body1);
      });
    });
  });
});
