// @vitest-environment node
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { once } from 'node:events';

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

const SENSITIVE_FIELDS = [
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
];

const mockQuestionRecord = {
  _id: '672000000000000000000001',
  id: 'q_algebra_test_01',
  questionUid: 'q_11111111111111111111111111111111',
  subject: 'mathematics',
  topic: 'algebra',
  chapter: 'linear-equations',
  concept: 'Variables',
  difficulty: 'medium',
  question: 'What is x if 2x + 6 = 12?',
  options: ['x = 2', 'x = 3', 'x = 4', 'x = 5'],
  // ── Vulnerability exposure surface ──
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
  source: 'pyq_internal_import',
  quizId: 'batch_upload_42',
};

describe('VULN-01 Regression: Question Answer, Solution & Metadata Redaction', () => {
  let app;
  let server;
  let baseUrl;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/questions', questionRoutes);
    // Generic error boundary
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

  // ── Public Endpoint Exposure Checks ──────────────────────

  it('redacts sensitive fields on public GET /api/questions (offset pagination)', async () => {
    const cursor = createMockCursor([{ ...mockQuestionRecord }]);
    getQuestionsCollectionMock.mockReturnValue({
      find: vi.fn(() => cursor),
      countDocuments: vi.fn(async () => 1),
    });

    const res = await fetch(`${baseUrl}?topic=algebra&limit=10`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.questions).toHaveLength(1);
    const q = body.questions[0];

    // Public contract fields must be present
    expect(q.id).toBe('q_algebra_test_01');
    expect(q.question).toBe('What is x if 2x + 6 = 12?');
    expect(q.options).toEqual(['x = 2', 'x = 3', 'x = 4', 'x = 5']);

    // Sensitive fields MUST be redacted
    for (const field of SENSITIVE_FIELDS) {
      expect(q[field], `Field "${field}" should not be exposed`).toBeUndefined();
    }
  });

  it('redacts sensitive fields on public GET /api/questions?pagination=cursor', async () => {
    const cursor = createMockCursor([{ ...mockQuestionRecord }]);
    getQuestionsCollectionMock.mockReturnValue({
      find: vi.fn(() => cursor),
      countDocuments: vi.fn(async () => 1),
    });

    const res = await fetch(`${baseUrl}?pagination=cursor&topic=algebra&limit=10`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.questions).toHaveLength(1);
    const q = body.questions[0];

    expect(q.id).toBe('q_algebra_test_01');
    for (const field of SENSITIVE_FIELDS) {
      expect(q[field], `Field "${field}" should not be exposed on cursor reads`).toBeUndefined();
    }
  });

  it('redacts sensitive fields on public GET /api/questions/:id', async () => {
    const cursor = createMockCursor([{ ...mockQuestionRecord }]);
    getQuestionsCollectionMock.mockReturnValue({
      find: vi.fn(() => cursor),
      findOne: vi.fn(async () => ({ ...mockQuestionRecord })),
    });

    const res = await fetch(`${baseUrl}/q_algebra_test_01`);
    expect(res.status).toBe(200);
    const q = await res.json();

    expect(q.id).toBe('q_algebra_test_01');
    expect(q.options).toBeDefined();

    for (const field of SENSITIVE_FIELDS) {
      expect(q[field], `Field "${field}" should not be exposed on single question lookup`).toBeUndefined();
    }
  });

  it('redacts sensitive fields on public GET /api/questions/session', async () => {
    const cursor = createMockCursor([{ ...mockQuestionRecord }]);
    getQuestionsCollectionMock.mockReturnValue({
      find: vi.fn(() => cursor),
    });

    const res = await fetch(`${baseUrl}/session?topic=algebra&limit=10`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.questions).toHaveLength(1);
    const sessionQ = body.questions[0];

    expect(sessionQ.id).toBe('q_algebra_test_01');
    expect(sessionQ.sessionAnchor).toBe(mockQuestionRecord._id);

    // Answer and solution must be stripped from public session
    expect(sessionQ.correctAnswer).toBeUndefined();
    expect(sessionQ.correctLetter).toBeUndefined();
    expect(sessionQ.solution).toBeUndefined();
    expect(sessionQ.solutionImage).toBeUndefined();
  });

  it('redacts sensitive fields on public POST /api/questions/session', async () => {
    const cursor = createMockCursor([{ ...mockQuestionRecord }]);
    getQuestionsCollectionMock.mockReturnValue({
      find: vi.fn(() => cursor),
    });

    const res = await fetch(`${baseUrl}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: 'algebra', limit: 10 }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.questions).toHaveLength(1);
    const sessionQ = body.questions[0];

    expect(sessionQ.correctAnswer).toBeUndefined();
    expect(sessionQ.correctLetter).toBeUndefined();
    expect(sessionQ.solution).toBeUndefined();
    expect(sessionQ.solutionImage).toBeUndefined();
  });

  it('redacts sensitive fields on public GET /api/questions/image', async () => {
    const cursor = createMockCursor([{ ...mockQuestionRecord }]);
    getQuestionsCollectionMock.mockReturnValue({
      find: vi.fn(() => cursor),
    });

    const res = await fetch(`${baseUrl}/image?topic=algebra&limit=10`);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.questions).toHaveLength(1);
    const imageQ = body.questions[0];

    expect(imageQ.correctAnswer).toBeUndefined();
    expect(imageQ.correctLetter).toBeUndefined();
    expect(imageQ.solution).toBeUndefined();
  });

  // ── Privileged & Submission Route Retention Checks ────────

  it('preserves full data with answers and solutions on privileged GET /api/questions/export', async () => {
    const cursor = createMockCursor([{ ...mockQuestionRecord }]);
    getQuestionsCollectionMock.mockReturnValue({
      find: vi.fn(() => cursor),
    });

    const res = await fetch(`${baseUrl}/export?topic=algebra`);
    expect(res.status).toBe(200);
    const ndjson = await res.text();
    const rows = ndjson.trim().split('\n').map((line) => JSON.parse(line));

    expect(rows).toHaveLength(1);
    const exportedQ = rows[0];

    // Privileged export retains full records
    expect(exportedQ.correctAnswer).toBe('x = 3');
    expect(exportedQ.solution).toContain('Subtract 6');
  });
});
