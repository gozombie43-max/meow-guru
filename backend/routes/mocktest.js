import express from 'express';
import { z } from 'zod';
import { idempotency } from '../middleware/idempotency.js';
import { protect } from '../middleware/protect.js';
import adminAuth from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { validateBody, validateParams } from '../middleware/validation.js';
import { adminGetPaperQuestions, adminSavePaperQuestions } from '../controllers/adminPaperEditorController.js';
import { parseQuestionExamMode } from '../services/questions/questionExamMode.js';
import { invalidateQuestionCaches } from '../services/questions/questionCache.js';
import { fetchCatalogSummary } from '../controllers/mockTestController.js';

import {
  fetchExamSlots,
  fetchSingleSlot,
  adminCreateSlot,
  adminUpdateSlot,
  adminDeleteSlot,
  adminFetchAllSlots,
  adminUploadPaper,
  adminSeedSlots,
  startMockTest,
  autosaveAttempt,
  submitAttemptHandler,
  getAttemptDetails,
  getTestHistoryHandler,
  getExamHistoryHandler,
} from '../controllers/mockTestController.js';

const router = express.Router();

const examSlugString = z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid exam slug');
const safeIdString = z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid identifier');

const examSlugParamsSchema = z.object({ examSlug: examSlugString });
const slotIdParamsSchema = z.object({ slotId: safeIdString });
const startParamsSchema = z.object({ examSlug: examSlugString, testId: safeIdString });
const attemptIdParamsSchema = z.object({ attemptId: safeIdString });

const singleSlotQuerySchema = z.object({
  examSlug: examSlugString.optional(),
});

const startBodySchema = z.preprocess(
  (value) => (value == null ? {} : value),
  z.object({
    restart: z.boolean().optional(),
    language: z.enum(['en', 'bn', 'hi']).optional(),
  }).passthrough(),
);

const autosaveBodySchema = z.object({
  revision: z.coerce.number().int().min(1),
  baseRevision: z.coerce.number().int().min(0).optional(),
  currentSection: z.coerce.number().int().min(0).max(50).optional(),
  currentQuestion: z.coerce.number().int().min(0).max(500).optional(),
  answers: z.record(z.string(), z.unknown()).optional(),
  questionStatuses: z.record(z.string(), z.unknown()).optional(),
  sectionTimers: z.record(z.string(), z.unknown()).optional(),
  language: z.enum(['en', 'bn', 'hi']).optional(),
  advanceSection: z.boolean().optional(),
}).passthrough();

const adminCreateSlotBodySchema = z.object({
  id: safeIdString,
  examSlug: examSlugString,
  configKey: z.string().trim().min(1).max(100),
  title: z.string().trim().min(1).max(240),
  tier: z.string().trim().max(80).nullable().optional(),
  type: z.enum(['mock', 'pyq']).optional(),
  isFree: z.boolean().optional(),
  order: z.coerce.number().int().min(0).max(10000).optional(),
  assessmentMode: z.enum(['practice', 'confidential']).optional(),
}).passthrough();

const adminUpdateSlotBodySchema = z.object({
  examSlug: examSlugString,
  title: z.string().trim().min(1).max(240).optional(),
  tier: z.string().trim().max(80).nullable().optional(),
  type: z.enum(['mock', 'pyq']).optional(),
  year: z.union([z.number().int().min(1900).max(2100), z.string().max(20), z.null()]).optional(),
  shift: z.union([z.number().int().min(1).max(20), z.string().max(40), z.null()]).optional(),
  examDate: z.string().max(40).nullable().optional(),
  isFree: z.boolean().optional(),
  order: z.coerce.number().int().min(0).max(10000).optional(),
  configKey: z.string().trim().min(1).max(100).optional(),
  timingPolicy: z.string().trim().max(40).optional(),
}).passthrough();

function validateQuerySafe(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    Object.defineProperty(req, 'query', {
      value: parsed.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return next();
  };
}

function invalidateOnAdminPaperWrite(req, res, next) {
  const originalJson = res.json.bind(res);
  let invalidated = false;
  res.json = (body) => {
    if (!invalidated && res.statusCode >= 200 && res.statusCode < 300) {
      invalidated = true;
      const exam = req.body?.examSlug || req.query?.examSlug;
      void invalidateQuestionCaches({ ...(exam ? { exam: String(exam) } : {}), bumpRevision: true })
        .catch(() => {})
        .finally(() => {
          if (!res.headersSent) originalJson(body);
        });
      return res;
    }
    return originalJson(body);
  };
  next();
}

router.use('/admin', (req, res, next) => {
  try {
    const mode = parseQuestionExamMode(req.query.examMode);
    if (mode && req.method !== 'GET' && req.path !== '/slots/seed') {
      const slug = req.body?.slot?.examSlug || req.body?.examSlug || (req.body?.paper?.exam || req.body?.exam)?.toLowerCase().replace('_', '-') || req.query.examSlug;
      if (!slug || String(slug).startsWith('iit-jam') !== (mode === 'iit-jam')) return res.status(400).json({ error: 'Choose a mock paper from the current exam mode' });
    }
    next();
  } catch (error) { res.status(error.statusCode || 400).json({ error: error.message }); }
});

// ─── Public Slot Routes ───────────────────────────────────

// GET /:examSlug/slots — Read catalog; default initialization is migration 018.
router.get('/catalog-metadata', fetchCatalogSummary);
router.get('/:examSlug/slots', validateParams(examSlugParamsSchema), fetchExamSlots);

// GET /slots/:slotId — Fetch a single slot by ID
router.get('/slots/:slotId', validateParams(slotIdParamsSchema), validateQuerySafe(singleSlotQuerySchema), fetchSingleSlot);

// ─── Admin Slot Management Routes (active admin/superadmin session) ───

// POST /admin/slots — Create a new mock test slot
router.post('/admin/slots', adminAuth, validateBody(adminCreateSlotBodySchema), adminCreateSlot);

// PATCH /admin/slots/:slotId — Update an existing mock test slot
router.patch('/admin/slots/:slotId', adminAuth, validateParams(slotIdParamsSchema), validateBody(adminUpdateSlotBodySchema), adminUpdateSlot);
router.get('/admin/slots/:slotId/questions', adminAuth, validateParams(slotIdParamsSchema), adminGetPaperQuestions);
router.patch('/admin/slots/:slotId/questions', adminAuth, validateParams(slotIdParamsSchema), invalidateOnAdminPaperWrite, adminSavePaperQuestions);
router.post('/admin/slots/:slotId/question-images-zip', adminAuth, validateParams(slotIdParamsSchema), uploadLimiter, invalidateOnAdminPaperWrite, async (req, res, next) => {
  try {
    const { handlePaperImageZip } = await import('../controllers/paperImageZipController.js');
    await handlePaperImageZip(req, res);
  } catch (error) { next(error); }
});

// DELETE /admin/slots/:slotId — Delete a mock test slot
router.delete('/admin/slots/:slotId', adminAuth, validateParams(slotIdParamsSchema), adminDeleteSlot);

// GET /admin/all-slots — Fetch all slots across all exams
router.get('/admin/all-slots', adminAuth, adminFetchAllSlots);

// POST /admin/upload-paper — Upload a full Mock Test or PYQ Paper with questions
router.post('/admin/upload-paper', adminAuth, adminUploadPaper);

// POST /admin/slots/seed — Explicitly trigger re-seeding default slots
router.post('/admin/slots/seed', adminAuth, adminSeedSlots);

// ─── User Attempt Routes (protect: JWT token) ─────────────

// POST /:examSlug/:testId/start — Start a new mock test attempt
// Start already deduplicates by its stored attempt key and returns live saved
// progress. Replaying the original JSON snapshot would undo reload recovery.
router.post('/:examSlug/:testId/start', protect, validateParams(startParamsSchema), validateBody(startBodySchema), startMockTest);

// PATCH /attempt/:attemptId/autosave — Autosave progress
router.patch('/attempt/:attemptId/autosave', protect, validateParams(attemptIdParamsSchema), validateBody(autosaveBodySchema), autosaveAttempt);

// POST /attempt/:attemptId/submit — Submit and grade attempt
router.post('/attempt/:attemptId/submit', protect, validateParams(attemptIdParamsSchema), idempotency('mock.submit'), submitAttemptHandler);

// GET /attempt/:attemptId — Get attempt details
router.get('/attempt/:attemptId', protect, validateParams(attemptIdParamsSchema), getAttemptDetails);

// GET /:examSlug/:testId/history — User's attempts for a specific test
router.get('/:examSlug/:testId/history', protect, validateParams(startParamsSchema), getTestHistoryHandler);

// GET /:examSlug/history — User's attempts across all tests for an exam
router.get('/:examSlug/history', protect, validateParams(examSlugParamsSchema), getExamHistoryHandler);

export default router;
