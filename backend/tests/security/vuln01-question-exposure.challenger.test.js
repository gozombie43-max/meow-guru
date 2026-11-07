// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { once } from 'node:events';
import { toPublicQuestionDTO, toQuizQuestionDTO } from '../../services/questions/quizQuestionDTO.js';

// Hoist mock references for isolation
const { getQuestionsCollectionMock } = vi.hoisted(() => ({
  getQuestionsCollectionMock: vi.fn(),
}));

vi.mock('../../config/mongodb.js', () => ({
  getQuestionsCollection: getQuestionsCollectionMock,
  getMongoDB: () => ({
    collection: getQuestionsCollectionMock,
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

// Bypass adminAuth in test fixture to verify export route retention
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

const ALL_SENSITIVE_TARGETS = [
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

const mockStandardQuestion = {
  _id: '672000000000000000000001',
  id: 'q_algebra_adv_01',
  questionUid: 'q_11111111111111111111111111111111',
  subject: 'mathematics',
  topic: 'algebra',
  chapter: 'linear-equations',
  concept: 'Variables',
  difficulty: 'medium',
  question: 'What is x if 2x + 6 = 12?',
  options: ['x = 2', 'x = 3', 'x = 4', 'x = 5'],
  correctAnswer: 'x = 3',
  correctLetter: 'b',
  solution: 'Subtract 6: 2x = 6. Divide by 2: x = 3.',
  solutionImage: 'https://cdn.meowguru.test/solutions/algebra_01.png',
  solutionImageWidth: 1024,
  solutionImageHeight: 768,
  ingestionKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  ingestionHash: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  battleSelectionKey: 'cccccccccccccccccccccccccccccccc',
  trainingCandidate: { legacyId: 'legacy_01', expectedTime: 45, discrimination: 1.2 },
  trainingEligible: true,
  trainingMetadataVersion: 2,
  trainingExamSlugs: ['ssc-cgl'],
  trainingSubjectSlug: 'math',
  trainingTopicSlug: 'algebra',
  source: 'pyq_internal_import',
  quizId: 'batch_upload_42',
};

describe('ADVERSARIAL CHALLENGER: VULN-01 Question Redaction & Security Boundary', () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/questions', questionRoutes);
    app.use((err, _req, res, _next) => {
      res.status(err.statusCode || 500).json({ error: err.message });
    });

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}/api/questions`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────
  // Dimension 1: Direct DTO Stress Testing & Corner Cases
  // ──────────────────────────────────────────────────────────

  describe('DTO Corner Cases: toPublicQuestionDTO & toQuizQuestionDTO', () => {
    it('handles null, undefined, primitives, and empty objects without crashing', () => {
      expect(toPublicQuestionDTO(null)).toBeNull();
      expect(toPublicQuestionDTO(undefined)).toBeUndefined();
      expect(toPublicQuestionDTO(42)).toBe(42);
      expect(toPublicQuestionDTO('string')).toBe('string');
      expect(toPublicQuestionDTO({})).toEqual({});

      expect(toQuizQuestionDTO(null)).toBeNull();
      expect(toQuizQuestionDTO(undefined)).toBeUndefined();
      expect(toQuizQuestionDTO(42)).toBe(42);
      expect(toQuizQuestionDTO('string')).toBe('string');
      expect(toQuizQuestionDTO({})).toEqual({});
    });

    it('handles Mongoose-like documents with .toObject() method', () => {
      const fakeMongooseDoc = {
        toObject: () => ({ ...mockStandardQuestion }),
        ...mockStandardQuestion,
      };
      const cleaned = toPublicQuestionDTO(fakeMongooseDoc);
      expect(cleaned._id).toBeUndefined();
      expect(cleaned.correctAnswer).toBeUndefined();
      expect(cleaned.solution).toBeUndefined();
      expect(cleaned.id).toBe('q_algebra_adv_01');
    });

    it('handles null prototype objects Object.create(null)', () => {
      const nullProtoDoc = Object.create(null);
      Object.assign(nullProtoDoc, mockStandardQuestion);
      const cleaned = toPublicQuestionDTO(nullProtoDoc);
      expect(cleaned._id).toBeUndefined();
      expect(cleaned.correctAnswer).toBeUndefined();
      expect(cleaned.solution).toBeUndefined();
      expect(cleaned.id).toBe('q_algebra_adv_01');
    });

    it('CHALLENGE: checks if prototype pollution can re-introduce sensitive fields', () => {
      try {
        Object.prototype.correctAnswer = 'POLLUTED_ANSWER';
        Object.prototype.solution = 'POLLUTED_SOLUTION';

        const rawDoc = { id: 'clean_q', question: 'test', options: ['a', 'b'] };
        const cleaned = toPublicQuestionDTO(rawDoc);

        // Verify that prototype properties are not own properties
        expect(Object.hasOwn(cleaned, 'correctAnswer')).toBe(false);
        expect(Object.hasOwn(cleaned, 'solution')).toBeUndefined ? expect(Object.prototype.hasOwnProperty.call(cleaned, 'solution')).toBe(false) : expect(Object.hasOwn(cleaned, 'solution')).toBe(false);

        // When serialized over the wire via JSON.stringify, prototype properties must not leak
        const wireString = JSON.stringify(cleaned);
        expect(wireString).not.toContain('POLLUTED_ANSWER');
        expect(wireString).not.toContain('POLLUTED_SOLUTION');
      } finally {
        delete Object.prototype.correctAnswer;
        delete Object.prototype.solution;
      }
    });

    it('CHALLENGE: tests nested translations containing solutions (VULN-01 Leakage Check)', () => {
      const docWithTranslations = {
        ...mockStandardQuestion,
        translations: {
          bn: {
            question: 'বাংলা প্রশ্ন?',
            options: ['১', '২', '৩', '৪'],
            solution: 'গোপন সমাধান: x = ৩',
            solutionImage: 'https://cdn.meowguru.test/bn_secret.png',
          },
        },
      };

      const publicDto = toPublicQuestionDTO(docWithTranslations);
      const quizDto = toQuizQuestionDTO(docWithTranslations);

      // Check whether translations.bn.solution is leaked to unauthenticated public
      const publicHasBnSolution = Boolean(publicDto.translations?.bn?.solution);
      const quizHasBnSolution = Boolean(quizDto.translations?.bn?.solution);

      // Record empirical behavior for challenge report
      expect(publicHasBnSolution).toBe(false);
      expect(quizHasBnSolution).toBe(false);
    });

    it('CHALLENGE: tests non-standard casing and legacy field names (solutionText, correctIndex, explanation)', () => {
      const weirdDoc = {
        _id: '672000000000000000000002',
        id: 'q_weird_02',
        question: 'Weird doc question',
        options: ['A', 'B', 'C', 'D'],
        // Standard names
        correctAnswer: 'B',
        solution: 'Standard solution',
        // Non-standard names / casing
        CorrectAnswer: 'B',
        solutionText: 'Legacy solution text that explains answer',
        correctIndex: 1,
        explanation: 'Detailed secret explanation',
      };

      const publicDto = toPublicQuestionDTO(weirdDoc);
      const quizDto = toQuizQuestionDTO(weirdDoc);

      // In quiz DTO (which uses projection allowlist), non-standard fields are dropped
      expect(quizDto.CorrectAnswer).toBeUndefined();
      expect(quizDto.solutionText).toBeUndefined();
      expect(quizDto.correctIndex).toBeUndefined();
      expect(quizDto.explanation).toBeUndefined();

      // In public DTO (which uses denylist), check if legacy fields leak
      expect(publicDto.CorrectAnswer).toBeUndefined();
      expect(publicDto.solutionText).toBeUndefined();
      expect(publicDto.correctIndex).toBeUndefined();
      expect(publicDto.explanation).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Dimension 2: Query Parameter Adversarial Testing
  // ──────────────────────────────────────────────────────────

  describe('Adversarial Query Parameters: limit, offset, and cursors', () => {
    it('handles limit=0 gracefully without leaking all questions or bypassing bounds', async () => {
      const cursor = createMockCursor([{ ...mockStandardQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        countDocuments: vi.fn(async () => 1),
      });

      const res = await fetch(`${baseUrl}?limit=0`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toHaveLength(1);
      expect(body.questions[0].correctAnswer).toBeUndefined();
    });

    it('handles negative limit (limit=-5) gracefully by clamping', async () => {
      const cursor = createMockCursor([{ ...mockStandardQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        countDocuments: vi.fn(async () => 1),
      });

      const res = await fetch(`${baseUrl}?limit=-5`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions[0].correctAnswer).toBeUndefined();
    });

    it('handles non-numeric limit (limit=abc) by falling back to safe default', async () => {
      const cursor = createMockCursor([{ ...mockStandardQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        countDocuments: vi.fn(async () => 1),
      });

      const res = await fetch(`${baseUrl}?limit=abc`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions[0].correctAnswer).toBeUndefined();
    });

    it('rejects massive offsets above 1000 with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}?offset=1500`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Offsets above 1000 are retired');
    });

    it('rejects malformed base64url cursor with 400 Bad Request', async () => {
      const res = await fetch(`${baseUrl}?pagination=cursor&cursor=not_a_valid_base64_cursor!!`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid question cursor');
    });

    it('rejects cursor with tampered signature fingerprint', async () => {
      const forgedCursor = Buffer.from(JSON.stringify({
        v: 1,
        f: '000000000000000000000000',
        _id: '672000000000000000000001',
      })).toString('base64url');

      const res = await fetch(`${baseUrl}?pagination=cursor&cursor=${forgedCursor}`);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('Invalid question cursor');
    });

    it('returns empty result set safely for unknown subjects/topics without error', async () => {
      const cursor = createMockCursor([]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        countDocuments: vi.fn(async () => 0),
      });

      const res = await fetch(`${baseUrl}?topic=completely_unknown_topic_99999`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toEqual([]);
      expect(body.count).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────
  // Dimension 3: Full Public Endpoint Redaction Coverage
  // ──────────────────────────────────────────────────────────

  describe('Comprehensive Endpoint Coverage for All Sensitive Fields', () => {
    it('verifies all 15 sensitive fields are stripped on GET /api/questions', async () => {
      const cursor = createMockCursor([{ ...mockStandardQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        countDocuments: vi.fn(async () => 1),
      });

      const res = await fetch(`${baseUrl}?topic=algebra`);
      const body = await res.json();
      const q = body.questions[0];

      for (const field of ALL_SENSITIVE_TARGETS) {
        expect(q[field], `Field ${field} must not be present on public read`).toBeUndefined();
      }
    });

    it('verifies all 15 sensitive fields are stripped on GET /api/questions/:id', async () => {
      const cursor = createMockCursor([{ ...mockStandardQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        findOne: vi.fn(async () => ({ ...mockStandardQuestion })),
      });

      const res = await fetch(`${baseUrl}/q_algebra_adv_01`);
      expect(res.status).toBe(200);
      const q = await res.json();

      for (const field of ALL_SENSITIVE_TARGETS) {
        expect(q[field], `Field ${field} must not be present on GET /:id`).toBeUndefined();
      }
    });

    it('EMPIRICAL LEAK TEST: checks if localized question leaks translations.bn.solution over public HTTP endpoints', async () => {
      const localizedDoc = {
        ...mockStandardQuestion,
        translations: {
          bn: {
            question: 'বাংলা প্রশ্ন?',
            options: ['১', '২', '৩', '৪'],
            solution: 'গোপন সমাধান: x = ৩',
            solutionImage: 'https://cdn.meowguru.test/bn_secret.png',
          },
        },
      };

      const cursor = createMockCursor([{ ...localizedDoc }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
        countDocuments: vi.fn(async () => 1),
      });

      // Test 1: GET /api/questions
      const resPublic = await fetch(`${baseUrl}?topic=algebra`);
      const bodyPublic = await resPublic.json();
      const qPublic = bodyPublic.questions[0];

      // Test 2: GET /api/questions/session
      const resSession = await fetch(`${baseUrl}/session?topic=algebra`);
      const bodySession = await resSession.json();
      const qSession = bodySession.questions[0];

      // Does public read leak translations.bn.solution?
      const publicLeaksSolution = Boolean(qPublic.translations?.bn?.solution);
      const sessionLeaksSolution = Boolean(qSession.translations?.bn?.solution);

      // Verify that public reads do NOT leak solutions
      expect(publicLeaksSolution).toBe(false);
      expect(sessionLeaksSolution).toBe(false);
    });

    it('verifies all 15 sensitive fields are stripped on GET /api/questions/session', async () => {
      const cursor = createMockCursor([{ ...mockStandardQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
      });

      const res = await fetch(`${baseUrl}/session?topic=algebra`);
      expect(res.status).toBe(200);
      const body = await res.json();
      const q = body.questions[0];

      for (const field of ALL_SENSITIVE_TARGETS) {
        expect(q[field], `Field ${field} must not be present on session GET`).toBeUndefined();
      }
    });

    it('verifies practice-test endpoint /api/questions/practice-test does not leak sensitive fields', async () => {
      const cursor = createMockCursor([{ ...mockStandardQuestion }]);
      getQuestionsCollectionMock.mockReturnValue({
        find: vi.fn(() => cursor),
      });

      const res = await fetch(`${baseUrl}/practice-test?subject=mathematics`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.questions).toHaveLength(1);
      const q = body.questions[0];

      expect(q.correctAnswer).toBeUndefined();
      expect(q.solution).toBeUndefined();
      expect(q.solutionImage).toBeUndefined();
      expect(q.ingestionKey).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────────────────
  // Dimension 4: Exam Submission & Grading Integrity Checks
  // ──────────────────────────────────────────────────────────

  describe('Exam Submission: POST /api/questions/answer', () => {
    it('requires Idempotency-Key matching submissionId', async () => {
      const res = await fetch(`${baseUrl}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': 'aaaaaaaaaaaaaaaa',
        },
        body: JSON.stringify({
          questionId: 'q_algebra_adv_01',
          questionUid: 'q_11111111111111111111111111111111',
          answer: 1,
          submissionId: 'key_different_456',
          questionIndex: 0,
          timeTaken: 10,
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain('matching Idempotency-Key required');
    });

    it('rejects answer out of range (answer index >= options length)', async () => {
      const subId = 'sub_oor_001';
      const res = await fetch(`${baseUrl}/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': subId,
        },
        body: JSON.stringify({
          questionId: 'q_algebra_adv_01',
          questionUid: 'q_11111111111111111111111111111111',
          answer: 99, // Outside options length
          submissionId: subId,
          questionIndex: 0,
          timeTaken: 10,
        }),
      });

      // Zod schema bounds answer to max 20, or server evaluates out-of-bounds options
      expect([400, 422]).toContain(res.status);
    });
  });
});
