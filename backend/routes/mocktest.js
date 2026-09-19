import express from 'express';
import { protect } from '../middleware/protect.js';
import adminAuth from '../middleware/auth.js';

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
  getExamHistoryHandler
} from '../controllers/mockTestController.js';

const router = express.Router();

// ─── Public Slot Routes ───────────────────────────────────

// GET /:examSlug/slots — Fetch all slots for an exam (auto-seeds if container empty)
router.get('/:examSlug/slots', fetchExamSlots);

// GET /slots/:slotId — Fetch a single slot by ID
router.get('/slots/:slotId', fetchSingleSlot);

// ─── Admin Slot Management Routes (adminAuth: x-admin-secret) ───

// POST /admin/slots — Create a new mock test slot
router.post('/admin/slots', adminAuth, adminCreateSlot);

// PATCH /admin/slots/:slotId — Update an existing mock test slot
router.patch('/admin/slots/:slotId', adminAuth, adminUpdateSlot);

// DELETE /admin/slots/:slotId — Delete a mock test slot
router.delete('/admin/slots/:slotId', adminAuth, adminDeleteSlot);

// GET /admin/all-slots — Fetch all slots across all exams
router.get('/admin/all-slots', adminAuth, adminFetchAllSlots);

// POST /admin/upload-paper — Upload a full Mock Test or PYQ Paper with questions
router.post('/admin/upload-paper', adminAuth, adminUploadPaper);

// POST /admin/slots/seed — Explicitly trigger re-seeding default slots
router.post('/admin/slots/seed', adminAuth, adminSeedSlots);

// ─── User Attempt Routes (protect: JWT token) ─────────────

// POST /:examSlug/:testId/start — Start a new mock test attempt
router.post('/:examSlug/:testId/start', protect, startMockTest);

// PATCH /attempt/:attemptId/autosave — Autosave progress
router.patch('/attempt/:attemptId/autosave', protect, autosaveAttempt);

// POST /attempt/:attemptId/submit — Submit and grade attempt
router.post('/attempt/:attemptId/submit', protect, submitAttemptHandler);

// GET /attempt/:attemptId — Get attempt details
router.get('/attempt/:attemptId', protect, getAttemptDetails);

// GET /:examSlug/:testId/history — User's attempts for a specific test
router.get('/:examSlug/:testId/history', protect, getTestHistoryHandler);

// GET /:examSlug/history — User's attempts across all tests for an exam
router.get('/:examSlug/history', protect, getExamHistoryHandler);

export default router;
