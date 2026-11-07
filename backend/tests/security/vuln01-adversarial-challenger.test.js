// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import { toPublicQuestionDTO, toQuizQuestionDTO, SENSITIVE_QUESTION_FIELDS } from '../../services/questions/quizQuestionDTO.js';

// Hoist mock references for isolation
const { getQuestionsCollectionMock, getMockSlotsCollectionMock } = vi.hoisted(() => ({
  getQuestionsCollectionMock: vi.fn(),
  getMockSlotsCollectionMock: vi.fn(),
}));

vi.mock('../../config/mongodb.js', () => ({
  getQuestionsCollection: getQuestionsCollectionMock,
  getMockSlotsCollection: getMockSlotsCollectionMock,
  getMongoDB: () => ({
    collection: (name) => {
      if (name === 'mockSlots') return getMockSlotsCollectionMock();
      return getQuestionsCollectionMock();
    },
  }),
  withMongoTransaction: vi.fn(async (cb) => {
    return cb({
      db: { collection: getQuestionsCollectionMock },
      session: {},
    });
  }),
}));

vi.mock('../../services/questions/questionMetadataCache.js', () => ({
  invalidateQuestionMetadata: vi.fn(),
  readQuestionMetadata: (_params, build) => build(),
}));

// Admin auth pass-through for test fixture
vi.mock('../../middleware/auth.js', () => ({
  default: (_req, _res, next) => next(),
  adminAuth: (_req, _res, next) => next(),
}));

// Mock protect for student answer submission
vi.mock('../../middleware/protect.js', () => ({
  protect: (req, _res, next) => {
    req.user = { id: 'test_student_user_1', role: 'student' };
    next();
  },
}));

import questionRoutes from '../../routes/questionRoutes.js';
import mocktestRoutes from '../../routes/mocktest.js';

function createMockCursor(docs) {
  const cursor = {
    project: vi.fn(() => cursor),
    sort: vi.fn(() => cursor),
    skip: vi.fn(() => cursor),
    limit: vi.fn(() => cursor),
    collation: vi.fn(() => cursor),
    toArray: vi.fn(async () => docs),
  };
  return cursor;
}

const ALL_SENSITIVE_METADATA_FIELDS = [
  'correctAnswer',
  'correctLetter',
  'solution',
  'solutionImage',
  'solutionImageWidth',
  'solutionImageHeight',
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

const comprehensiveMockQuestion = {
  _id: '672000000000000000000099',
  id: 'q_adversarial_test_01',
  questionUid: 'q_99999999999999999999999999999999',
  subject: 'mathematics',
  topic: 'algebra',
  chapter: 'linear-equations',
  concept: 'Variables',
  difficulty: 'medium',
  question: 'Adversarial question payload: solve 3x + 9 = 21?',
  options: ['x = 3', 'x = 4', 'x = 5', 'x = 6'],
  // ── Vulnerability exposure surface ──
  correctAnswer: 'x = 4',
  correctLetter: 'b',
  solution: '3x = 12 => x = 4.',
  solutionImage: 'https://cdn.meowguru.test/solutions/adv_01.png',
  solutionImageWidth: 800,
  solutionImageHeight: 600,
  ingestionKey: 'aaaaaaaaaaaaaaaaaaaaaaaa',
  ingestionHash: 'bbbbbbbbbbbbbbbbbbbbbbbb',
  battleSelectionKey: 'cccccccccccccccccccccccc',
  trainingCandidate: { legacyId: 'legacy_adv_01', expectedTime: 30, discrimination: 1.5 },
  trainingEligible: true,
  trainingMetadataVersion: 1,
  trainingExamSlugs: ['ssc-cgl'],
  trainingSubjectSlug: 'mathematics',
  trainingTopicSlug: 'algebra',
  source: 'pyq_internal_ingestion',
  quizId: 'batch_adv_99',
  extraCustomField: 'should_remain_if_not_sensitive',
};

describe('Adversarial Challenge: Milestone 1 (VULN-01) Remediation', () => {
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
    vi.clearAllMocks();
  });

  describe('Task 1: Empirically verify ingestion metadata & answer keys 100% blocked from unauthenticated endpoints', () => {
    it('blocks 100% of sensitive & ingestion metadata on GET /api/questions (offset pagination)', async () => {
      const cursor = createMockCursor([{ ...comprehensiveMockQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        countDocuments: vi.fn(async () => 1),
      });

      const res = await fetch(`${baseUrl}/api/questions?topic=algebra&limit=10`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toHaveLength(1);
      const q = body.questions[0];

      expect(q.id).toBe('q_adversarial_test_01');
      expect(q.question).toBe('Adversarial question payload: solve 3x + 9 = 21?');
      expect(q.extraCustomField).toBe('should_remain_if_not_sensitive');

      for (const field of ALL_SENSITIVE_METADATA_FIELDS) {
        expect(q[field], `Expected field "${field}" to be 100% blocked on GET /api/questions`).toBeUndefined();
      }
    });

    it('blocks 100% of sensitive & ingestion metadata on GET /api/questions?pagination=cursor', async () => {
      const cursor = createMockCursor([{ ...comprehensiveMockQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        countDocuments: vi.fn(async () => 1),
      });

      const res = await fetch(`${baseUrl}/api/questions?pagination=cursor&topic=algebra&limit=10`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toHaveLength(1);
      const q = body.questions[0];

      expect(q.id).toBe('q_adversarial_test_01');
      for (const field of ALL_SENSITIVE_METADATA_FIELDS) {
        expect(q[field], `Expected field "${field}" to be 100% blocked on cursor pagination`).toBeUndefined();
      }
    });

    it('blocks 100% of sensitive & ingestion metadata on GET /api/questions/:id', async () => {
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => createMockCursor([{ ...comprehensiveMockQuestion }])),
        findOne: vi.fn(async () => ({ ...comprehensiveMockQuestion })),
      });

      const res = await fetch(`${baseUrl}/api/questions/q_adversarial_test_01`);
      expect(res.status).toBe(200);
      const q = await res.json();

      expect(q.id).toBe('q_adversarial_test_01');
      for (const field of ALL_SENSITIVE_METADATA_FIELDS) {
        expect(q[field], `Expected field "${field}" to be 100% blocked on single question lookup`).toBeUndefined();
      }
    });

    it('blocks 100% of sensitive & ingestion metadata on GET /api/questions/session', async () => {
      const cursor = createMockCursor([{ ...comprehensiveMockQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
      });

      const res = await fetch(`${baseUrl}/api/questions/session?topic=algebra&limit=10`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toHaveLength(1);
      const q = body.questions[0];

      expect(q.id).toBe('q_adversarial_test_01');
      expect(q.sessionAnchor).toBe(comprehensiveMockQuestion._id);
      for (const field of ALL_SENSITIVE_METADATA_FIELDS) {
        expect(q[field], `Expected field "${field}" to be 100% blocked on GET /api/questions/session`).toBeUndefined();
      }
    });

    it('blocks 100% of sensitive & ingestion metadata on POST /api/questions/session', async () => {
      const cursor = createMockCursor([{ ...comprehensiveMockQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
      });

      const res = await fetch(`${baseUrl}/api/questions/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: 'algebra', limit: 10 }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toHaveLength(1);
      const q = body.questions[0];

      expect(q.id).toBe('q_adversarial_test_01');
      for (const field of ALL_SENSITIVE_METADATA_FIELDS) {
        expect(q[field], `Expected field "${field}" to be 100% blocked on POST /api/questions/session`).toBeUndefined();
      }
    });

    it('blocks 100% of sensitive & ingestion metadata on GET /api/questions/image', async () => {
      const cursor = createMockCursor([{ ...comprehensiveMockQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
      });

      const res = await fetch(`${baseUrl}/api/questions/image?topic=algebra&limit=10`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toHaveLength(1);
      const q = body.questions[0];

      expect(q.id).toBe('q_adversarial_test_01');
      for (const field of ALL_SENSITIVE_METADATA_FIELDS) {
        expect(q[field], `Expected field "${field}" to be 100% blocked on GET /api/questions/image`).toBeUndefined();
      }
    });

    it('blocks 100% of sensitive & ingestion metadata on GET /api/questions/practice-test', async () => {
      const cursor = createMockCursor([{ ...comprehensiveMockQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
      });

      const res = await fetch(`${baseUrl}/api/questions/practice-test?subject=mathematics&count=5`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toHaveLength(1);
      const q = body.questions[0];

      expect(q.id).toBe('q_adversarial_test_01');
      for (const field of ALL_SENSITIVE_METADATA_FIELDS) {
        expect(q[field], `Expected field "${field}" to be 100% blocked on GET /api/questions/practice-test`).toBeUndefined();
      }
    });
  });

  describe('Task 1 (Part B): Verify privileged export & review workflows maintain FULL access', () => {
    it('maintains full access to answer keys, solutions, and ingestion metadata on GET /api/questions/export (ndjson)', async () => {
      const cursor = createMockCursor([{ ...comprehensiveMockQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
      });

      const res = await fetch(`${baseUrl}/api/questions/export?topic=algebra`);
      expect(res.status).toBe(200);
      const ndjson = await res.text();
      const rows = ndjson.trim().split('\n').map((line) => JSON.parse(line));
      expect(rows).toHaveLength(1);
      const exported = rows[0];

      // Verifying complete access retention
      expect(exported.correctAnswer).toBe('x = 4');
      expect(exported.correctLetter).toBe('b');
      expect(exported.solution).toBe('3x = 12 => x = 4.');
      expect(exported.solutionImage).toBe('https://cdn.meowguru.test/solutions/adv_01.png');
      expect(exported.ingestionKey).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
      expect(exported.ingestionHash).toBe('bbbbbbbbbbbbbbbbbbbbbbbb');
      expect(exported.battleSelectionKey).toBe('cccccccccccccccccccccccc');
      expect(exported.trainingCandidate).toEqual({ legacyId: 'legacy_adv_01', expectedTime: 30, discrimination: 1.5 });
      expect(exported.trainingEligible).toBe(true);
    });

    it('maintains full access on GET /api/questions/export?format=json', async () => {
      const cursor = createMockCursor([{ ...comprehensiveMockQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
      });

      const res = await fetch(`${baseUrl}/api/questions/export?topic=algebra&format=json`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toHaveLength(1);
      const exported = body.questions[0];

      expect(exported.correctAnswer).toBe('x = 4');
      expect(exported.solution).toBe('3x = 12 => x = 4.');
      expect(exported.ingestionKey).toBe('aaaaaaaaaaaaaaaaaaaaaaaa');
    });

    it('maintains full access on adminGetPaperQuestions (GET /api/mocktest/admin/slots/:slotId/questions)', async () => {
      const mockSlot = {
        id: 'slot_adv_01',
        examSlug: 'ssc-cgl',
        title: 'Adversarial Paper',
        updatedAt: '2026-11-07T12:00:00.000Z',
        fixedQuestions: [
          {
            id: 'q_paper_1',
            sectionKey: 'math',
            questionType: 'MCQ',
            question: 'Solve 2 + 2?',
            options: ['2', '3', '4', '5'],
            correctAnswer: '4',
            solution: '2 + 2 = 4',
            image: null,
          },
        ],
      };

      getMockSlotsCollectionMock.mockReturnValue({
        findOne: vi.fn(async () => mockSlot),
      });

      const res = await fetch(`${baseUrl}/api/mocktest/admin/slots/slot_adv_01/questions?examSlug=ssc-cgl&examMode=ssc`);
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.title).toBe('Adversarial Paper');
      expect(data.questions).toHaveLength(1);
      const paperQ = data.questions[0];
      expect(paperQ.correctAnswer).toBe(2); // index 2 corresponds to '4'
      expect(paperQ.solution).toBe('2 + 2 = 4');
    });
  });

  describe('Task 2 & 3: Edge-Case Stability of toPublicQuestionDTO', () => {
    it('handles null, undefined, and non-object inputs safely without throwing', () => {
      expect(toPublicQuestionDTO(null)).toBeNull();
      expect(toPublicQuestionDTO(undefined)).toBeUndefined();
      expect(toPublicQuestionDTO(0)).toBe(0);
      expect(toPublicQuestionDTO(42)).toBe(42);
      expect(toPublicQuestionDTO(false)).toBe(false);
      expect(toPublicQuestionDTO(true)).toBe(true);
      expect(toPublicQuestionDTO('')).toBe('');
      expect(toPublicQuestionDTO('a string')).toBe('a string');
    });

    it('handles empty document and documents without _id safely', () => {
      expect(toPublicQuestionDTO({})).toEqual({});
      expect(toPublicQuestionDTO({ id: 'only_id' })).toEqual({ id: 'only_id' });
      expect(toPublicQuestionDTO({ _id: 'some_id' })).toEqual({});
      expect(toPublicQuestionDTO({ _id: null, id: 'q1' })).toEqual({ id: 'q1' });
      expect(toPublicQuestionDTO({ _id: undefined, id: 'q1' })).toEqual({ id: 'q1' });
    });

    it('safely handles missing, null, and undefined attributes inside document', () => {
      const input = {
        _id: 'mongo_1',
        id: 'q_edge',
        question: 'What is test?',
        options: null,
        correctAnswer: null,
        solution: undefined,
        ingestionKey: null,
        ingestionHash: undefined,
        battleSelectionKey: null,
        trainingCandidate: null,
        customNullField: null,
        customUndefinedField: undefined,
      };

      const result = toPublicQuestionDTO(input);

      // Sensitive fields must be completely deleted
      expect('correctAnswer' in result).toBe(false);
      expect('solution' in result).toBe(false);
      expect('ingestionKey' in result).toBe(false);
      expect('ingestionHash' in result).toBe(false);
      expect('battleSelectionKey' in result).toBe(false);
      expect('trainingCandidate' in result).toBe(false);

      // Non-sensitive fields should be preserved accurately
      expect(result.id).toBe('q_edge');
      expect(result.question).toBe('What is test?');
      expect(result.options).toBeNull();
      expect(result.customNullField).toBeNull();
      expect(result.customUndefinedField).toBeUndefined();
    });

    it('safely preserves extra and unexpected document attributes', () => {
      const input = {
        _id: 'mongo_extra',
        id: 'q_extra',
        correctAnswer: 'leak me',
        solution: 'step 1',
        extraMetadata: { deep: true, count: 5 },
        tags: ['ssc', 'cgl', 'algebra'],
        flagValue: false,
        scoreMultiplier: 1.5,
      };

      const result = toPublicQuestionDTO(input);

      expect(result.correctAnswer).toBeUndefined();
      expect(result.solution).toBeUndefined();
      expect(result.id).toBe('q_extra');
      expect(result.extraMetadata).toEqual({ deep: true, count: 5 });
      expect(result.tags).toEqual(['ssc', 'cgl', 'algebra']);
      expect(result.flagValue).toBe(false);
      expect(result.scoreMultiplier).toBe(1.5);
    });

    it('safely handles prototype-less objects (Object.create(null))', () => {
      const input = Object.create(null);
      input._id = 'mongo_no_proto';
      input.id = 'q_no_proto';
      input.correctAnswer = 'answer';
      input.ingestionKey = 'key';

      const result = toPublicQuestionDTO(input);
      expect(result.id).toBe('q_no_proto');
      expect(result._id).toBeUndefined();
      expect(result.correctAnswer).toBeUndefined();
      expect(result.ingestionKey).toBeUndefined();
    });

    it('safely handles Mongoose-like documents with .toObject()', () => {
      const mockMongooseDoc = {
        toObject: () => ({
          _id: 'mongoose_id',
          id: 'q_mongoose',
          correctAnswer: 'mongoose_answer',
          solution: 'mongoose_solution',
          ingestionKey: 'mongoose_ingest',
          question: 'Mongoose question?',
        }),
      };

      const result = toPublicQuestionDTO(mockMongooseDoc);
      expect(result.id).toBe('q_mongoose');
      expect(result.question).toBe('Mongoose question?');
      expect(result._id).toBeUndefined();
      expect(result.correctAnswer).toBeUndefined();
      expect(result.solution).toBeUndefined();
      expect(result.ingestionKey).toBeUndefined();
    });

    it('safely handles documents where toObject is NOT a function', () => {
      const input = {
        _id: 'id_1',
        id: 'q_non_func',
        toObject: 'not a function, just a question property',
        correctAnswer: 'secret',
      };

      const result = toPublicQuestionDTO(input);
      expect(result.id).toBe('q_non_func');
      expect(result.toObject).toBe('not a function, just a question property');
      expect(result.correctAnswer).toBeUndefined();
    });

    it('does not mutate the original input document', () => {
      const original = {
        _id: 'mongo_orig',
        id: 'q_orig',
        correctAnswer: 'original_secret',
        solution: 'original_solution',
        ingestionKey: 'orig_key',
      };

      const originalClone = { ...original };
      toPublicQuestionDTO(original);

      expect(original).toEqual(originalClone);
      expect(original.correctAnswer).toBe('original_secret');
      expect(original.ingestionKey).toBe('orig_key');
    });
  });

  describe('Edge-Case Stability of toQuizQuestionDTO', () => {
    it('handles null, undefined, and primitives safely', () => {
      expect(toQuizQuestionDTO(null)).toBeNull();
      expect(toQuizQuestionDTO(undefined)).toBeUndefined();
      expect(toQuizQuestionDTO(0)).toBe(0);
      expect(toQuizQuestionDTO('string')).toBe('string');
    });

    it('never leaks sensitive attributes or unprojected fields through toQuizQuestionDTO', () => {
      const input = {
        _id: 'anchor_id_123',
        id: 'q_quiz',
        question: 'Quiz question',
        options: ['1', '2'],
        correctAnswer: '1',
        solution: 'sol',
        ingestionKey: 'ingest_123',
        arbitraryUnprojectedField: 'hidden',
      };

      const result = toQuizQuestionDTO(input);
      expect(result.id).toBe('q_quiz');
      expect(result.sessionAnchor).toBe('anchor_id_123');
      expect(result.question).toBe('Quiz question');
      expect(result.options).toEqual(['1', '2']);

      expect(result.correctAnswer).toBeUndefined();
      expect(result.solution).toBeUndefined();
      expect(result.ingestionKey).toBeUndefined();
      expect(result.arbitraryUnprojectedField).toBeUndefined();
    });

    it('safely preserves pre-existing sessionAnchor if _id is missing', () => {
      const input = {
        id: 'q_quiz_2',
        sessionAnchor: 'existing_anchor_456',
        question: 'Quiz question 2',
      };

      const result = toQuizQuestionDTO(input);
      expect(result.id).toBe('q_quiz_2');
      expect(result.sessionAnchor).toBe('existing_anchor_456');
    });
  });
});
