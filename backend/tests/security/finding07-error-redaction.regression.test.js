/**
 * FINDING-07 regression: Internal Error Disclosure Redaction on 500 Responses.
 *
 * Verifies that unexpected 5xx exceptions across routes and controllers never
 * leak raw internal error messages (e.g. MongoDB connection strings, S3 bucket
 * details, stack traces) to clients, while preserving:
 *   1. Server-side structured logging via runtimeLog.error
 *   2. Intentional 4xx domain error messages (err.statusCode < 500)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockRuntimeError,
  mockListTopicPdfs,
  mockGetSignedUrl,
  mockGetUser,
  mockListAiChatSummaries,
  mockFetchQuestions,
  mockCreateMockSlot,
  mockUpdateMockSlot,
  mockDeleteMockSlot,
  mockUploadFullPaper,
  mockFetchTopicCountSnapshot,
} = vi.hoisted(() => ({
  mockRuntimeError: vi.fn(),
  mockListTopicPdfs: vi.fn(),
  mockGetSignedUrl: vi.fn(),
  mockGetUser: vi.fn(),
  mockListAiChatSummaries: vi.fn(),
  mockFetchQuestions: vi.fn(),
  mockCreateMockSlot: vi.fn(),
  mockUpdateMockSlot: vi.fn(),
  mockDeleteMockSlot: vi.fn(),
  mockUploadFullPaper: vi.fn(),
  mockFetchTopicCountSnapshot: vi.fn(),
}));

vi.mock('../../infrastructure/runtimeLog.js', () => ({
  runtimeLog: {
    info: vi.fn(),
    warn: vi.fn(),
    error: (...args) => mockRuntimeError(...args),
  },
}));

vi.mock('../../services/documents/pdfCatalogService.js', () => ({
  listTopicPdfs: (...args) => mockListTopicPdfs(...args),
  invalidatePdfCache: vi.fn(),
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args) => mockGetSignedUrl(...args),
}));

vi.mock('../../config/b2.js', () => ({
  b2Client: { send: vi.fn() },
  B2_BUCKET: 'test-bucket',
}));

vi.mock('../../repositories/userRepository.js', () => ({
  getUser: (...args) => mockGetUser(...args),
  updateUser: vi.fn(),
  updateUserProgress: vi.fn(),
  trackStudyUsage: vi.fn(),
  mutateUserList: vi.fn(),
  findQuestionForBookmark: vi.fn(),
}));

vi.mock('../../repositories/aiChatRepository.js', () => ({
  listAiChatSummaries: (...args) => mockListAiChatSummaries(...args),
  readAiChat: vi.fn(),
  appendAiChatMessages: vi.fn(),
  writeAiChat: vi.fn(),
}));

vi.mock('../../services/questionService.js', () => ({
  fetchQuestions: (...args) => mockFetchQuestions(...args),
  createQuestion: vi.fn(),
  exportQuestions: vi.fn(),
  fetchQuestionCounts: vi.fn(),
  fetchPracticeTest: vi.fn(),
  analyzeAnswers: vi.fn(),
  fetchQuestionById: vi.fn(),
  modifyQuestion: vi.fn(),
  removeQuestion: vi.fn(),
  createQuestionsBulk: vi.fn(),
  removeQuestionsBulk: vi.fn(),
  checkDuplicates: vi.fn(),
  fetchImageQuestions: vi.fn(),
  fetchQuestionsSession: vi.fn(),
  fetchQuestionsMeta: vi.fn(),
  processUserAnswer: vi.fn(),
}));

vi.mock('../../services/mockTestEngine.js', () => ({
  buildPaper: vi.fn(),
  gradeAttempt: vi.fn(),
  computePercentile: vi.fn(),
  fetchSlotsForExam: vi.fn(),
  fetchSlotById: vi.fn(),
  fetchAllAdminSlots: vi.fn(),
  seedDefaultSlots: vi.fn(),
  createMockSlot: (...args) => mockCreateMockSlot(...args),
  updateMockSlot: (...args) => mockUpdateMockSlot(...args),
  deleteMockSlot: (...args) => mockDeleteMockSlot(...args),
  uploadFullPaper: (...args) => mockUploadFullPaper(...args),
  summarizeSlot: vi.fn(),
}));

vi.mock('../../services/questions/topicCountSnapshot.js', () => ({
  fetchTopicCountSnapshot: (...args) => mockFetchTopicCountSnapshot(...args),
  fetchPublicTopicCountSnapshot: (...args) => mockFetchTopicCountSnapshot(...args),
}));

import express from 'express';
import pdfsRouter from '../../routes/pdfs.js';
import progressRouter from '../../routes/progress.routes.js';
import { getMe, getAiChats, getNotificationPreferences } from '../../controllers/userController.js';
import questionController from '../../controllers/questionController.js';
import {
  adminCreateSlot,
  adminUpdateSlot,
  adminDeleteSlot,
  adminUploadPaper,
} from '../../controllers/mockTestController.js';
import { getPdfId } from '../../services/documents/pdfDocumentModel.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    set(key, val) {
      this.headers[key] = val;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('FINDING-07: Internal 500 error details are redacted while preserving server logs and 4xx messages', () => {
  const SENSITIVE_DB_ERROR =
    'MongoServerSelectionError: connect ECONNREFUSED 10.240.0.14:27017 (replicaSet=prod-rs0)';
  const SENSITIVE_S3_ERROR =
    'InvalidAccessKeyId: The AWS Access Key Id you provided does not exist in bucket quizguru-prod-b2';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. PDF routes (backend/routes/pdfs.js)', () => {
    it('redacts internal storage errors on GET /api/pdfs and logs server-side', async () => {
      mockListTopicPdfs.mockRejectedValueOnce(new Error(SENSITIVE_S3_ERROR));

      const app = express();
      app.use('/api/pdfs', pdfsRouter);
      const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
      });
      try {
        const port = server.address().port;
        const res = await fetch(`http://127.0.0.1:${port}/api/pdfs?topic=percentages`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Failed to fetch PDFs');
        expect(JSON.stringify(body)).not.toContain('InvalidAccessKeyId');
        expect(JSON.stringify(body)).not.toContain('quizguru-prod-b2');
        expect(mockRuntimeError).toHaveBeenCalled();
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });

    it('redacts internal presigner errors on GET /api/pdfs/stream/:id and logs server-side', async () => {
      mockGetSignedUrl.mockRejectedValueOnce(new Error(SENSITIVE_S3_ERROR));

      const app = express();
      app.use('/api/pdfs', pdfsRouter);
      const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
      });
      try {
        const port = server.address().port;
        const pdfId = getPdfId('percentages/notes/algebra.pdf');
        const res = await fetch(`http://127.0.0.1:${port}/api/pdfs/stream/${pdfId}`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Failed to open PDF');
        expect(JSON.stringify(body)).not.toContain('InvalidAccessKeyId');
        expect(mockRuntimeError).toHaveBeenCalled();
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });

  describe('2. User controller (backend/controllers/userController.js)', () => {
    it('redacts raw 500 error in getMe and logs via runtimeLog.error', async () => {
      mockGetUser.mockRejectedValueOnce(new Error(SENSITIVE_DB_ERROR));
      const req = { user: { id: 'u1', role: 'user' } };
      const res = createMockRes();

      await getMe(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Failed to fetch user profile');
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
      expect(JSON.stringify(res.body)).not.toContain('prod-rs0');
      expect(mockRuntimeError).toHaveBeenCalled();
    });

    it('redacts raw 500 error in getNotificationPreferences and logs via runtimeLog.error', async () => {
      mockGetUser.mockRejectedValueOnce(new Error(SENSITIVE_DB_ERROR));
      const req = { user: { id: 'u1' } };
      const res = createMockRes();

      await getNotificationPreferences(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Failed to fetch notification preferences');
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
      expect(mockRuntimeError).toHaveBeenCalled();
    });

    it('preserves intentional 4xx domain errors in getAiChats without logging as 500', async () => {
      const domainErr = new Error('Chat quota exceeded for session');
      domainErr.statusCode = 429;
      mockListAiChatSummaries.mockRejectedValueOnce(domainErr);

      const req = { user: { id: 'u1' } };
      const res = createMockRes();

      await getAiChats(req, res);

      expect(res.statusCode).toBe(429);
      expect(res.body.error).toBe('Chat quota exceeded for session');
      expect(mockRuntimeError).not.toHaveBeenCalled();
    });
  });

  describe('3. Question controller (backend/controllers/questionController.js)', () => {
    it('redacts raw 500 error in getQuestions and logs via runtimeLog.error', async () => {
      mockFetchQuestions.mockRejectedValueOnce(new Error(SENSITIVE_DB_ERROR));
      const req = { query: { subject: 'mathematics' } };
      const res = createMockRes();

      await questionController.getQuestions(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.error).toBe('Failed to fetch questions');
      expect(JSON.stringify(res.body)).not.toContain('ECONNREFUSED');
      expect(mockRuntimeError).toHaveBeenCalled();
    });

    it('preserves 4xx validation error message and code in getQuestions', async () => {
      const validationErr = new Error('Invalid topic filter');
      validationErr.statusCode = 400;
      validationErr.code = 'INVALID_TOPIC';
      mockFetchQuestions.mockRejectedValueOnce(validationErr);

      const req = { query: { subject: 'mathematics' } };
      const res = createMockRes();

      await questionController.getQuestions(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({
        error: 'Invalid topic filter',
        code: 'INVALID_TOPIC',
      });
      expect(mockRuntimeError).not.toHaveBeenCalled();
    });
  });

  describe('4. Mock test controller (backend/controllers/mockTestController.js)', () => {
    it('redacts raw 500 error in adminCreateSlot, adminUpdateSlot, adminDeleteSlot, and adminUploadPaper', async () => {
      mockCreateMockSlot.mockRejectedValueOnce(new Error(SENSITIVE_DB_ERROR));
      const resCreate = createMockRes();
      await adminCreateSlot(
        { body: { id: 's1', examSlug: 'ssc-cgl', configKey: 'cfg', title: 'Mock 1' } },
        resCreate
      );
      expect(resCreate.statusCode).toBe(500);
      expect(resCreate.body.error).toBe('Failed to create mock slot');
      expect(JSON.stringify(resCreate.body)).not.toContain('ECONNREFUSED');

      mockUpdateMockSlot.mockRejectedValueOnce(new Error(SENSITIVE_DB_ERROR));
      const resUpdate = createMockRes();
      await adminUpdateSlot(
        { params: { slotId: 's1' }, body: { examSlug: 'ssc-cgl', title: 'Updated' } },
        resUpdate
      );
      expect(resUpdate.statusCode).toBe(500);
      expect(resUpdate.body.error).toBe('Failed to update mock slot');

      mockDeleteMockSlot.mockRejectedValueOnce(new Error(SENSITIVE_DB_ERROR));
      const resDelete = createMockRes();
      await adminDeleteSlot(
        { params: { slotId: 's1' }, query: { examSlug: 'ssc-cgl' }, body: {} },
        resDelete
      );
      expect(resDelete.statusCode).toBe(500);
      expect(resDelete.body.error).toBe('Failed to delete mock slot');

      mockUploadFullPaper.mockRejectedValueOnce(new Error(SENSITIVE_DB_ERROR));
      const resUpload = createMockRes();
      await adminUploadPaper(
        { query: {}, body: { slot: { id: 's1', title: 'T' }, questions: [{ id: 'q1' }] } },
        resUpload
      );
      expect(resUpload.statusCode).toBe(500);
      expect(resUpload.body.error).toBe('Failed to upload mock test / PYQ paper');
      expect(mockRuntimeError).toHaveBeenCalledTimes(4);
    });
  });

  describe('5. Progress routes (backend/routes/progress.routes.js)', () => {
    it('redacts raw 500 error on GET /api/progress/topics and logs via runtimeLog.error', async () => {
      mockFetchTopicCountSnapshot.mockRejectedValueOnce(new Error(SENSITIVE_DB_ERROR));

      const app = express();
      app.use('/api/progress', progressRouter);
      const server = await new Promise((resolve) => {
        const s = app.listen(0, () => resolve(s));
      });
      try {
        const port = server.address().port;
        const res = await fetch(`http://127.0.0.1:${port}/api/progress/topics?subject=mathematics`);
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error).toBe('Failed to fetch topic progress');
        expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
        expect(mockRuntimeError).toHaveBeenCalled();
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    });
  });
});
