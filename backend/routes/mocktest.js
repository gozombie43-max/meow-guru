import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { protect } from '../middleware/protect.js';
import adminAuth from '../middleware/auth.js';
import { getMockAttemptsContainer } from '../containerStore.js';
import {
  buildPaper,
  gradeAttempt,
  computePercentile,
  fetchSlotsForExam,
  fetchSlotById,
  fetchAllAdminSlots,
  seedDefaultSlots,
  createMockSlot,
  updateMockSlot,
  deleteMockSlot,
  uploadFullPaper,
} from '../services/mockTestEngine.js';

const router = express.Router();

// ─── Public Slot Routes ───────────────────────────────────

// GET /:examSlug/slots — Fetch all slots for an exam (auto-seeds if container empty)
router.get('/:examSlug/slots', async (req, res) => {
  try {
    const { examSlug } = req.params;
    const slots = await fetchSlotsForExam(examSlug);
    res.json({ slots });
  } catch (err) {
    console.error('Fetch slots error:', err);
    res.status(500).json({ error: 'Failed to fetch mock test slots' });
  }
});

// GET /slots/:slotId — Fetch a single slot by ID
router.get('/slots/:slotId', async (req, res) => {
  try {
    const { slotId } = req.params;
    const examSlug = req.query.examSlug;
    const slot = await fetchSlotById(examSlug, slotId);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json({ slot });
  } catch (err) {
    console.error('Fetch single slot error:', err);
    res.status(500).json({ error: 'Failed to fetch slot details' });
  }
});

// ─── Admin Slot Management Routes (adminAuth: x-admin-secret) ───

// POST /admin/slots — Create a new mock test slot
router.post('/admin/slots', adminAuth, async (req, res) => {
  try {
    const { id, examSlug, configKey, title, tier, isFree, order } = req.body;
    if (!id || !examSlug || !configKey || !title) {
      return res.status(400).json({ error: 'id, examSlug, configKey, and title are required' });
    }

    const createdSlot = await createMockSlot({ id, examSlug, configKey, title, tier, isFree, order });
    res.status(201).json({ success: true, slot: createdSlot });
  } catch (err) {
    console.error('Admin create slot error:', err);
    res.status(500).json({ error: err.message || 'Failed to create mock slot' });
  }
});

// PATCH /admin/slots/:slotId — Update an existing mock test slot
router.patch('/admin/slots/:slotId', adminAuth, async (req, res) => {
  try {
    const { slotId } = req.params;
    const { examSlug, ...updates } = req.body;
    if (!examSlug) {
      return res.status(400).json({ error: 'examSlug is required in body to locate the partition' });
    }

    const updatedSlot = await updateMockSlot(examSlug, slotId, updates);
    res.json({ success: true, slot: updatedSlot });
  } catch (err) {
    console.error('Admin update slot error:', err);
    res.status(500).json({ error: err.message || 'Failed to update mock slot' });
  }
});

// DELETE /admin/slots/:slotId — Delete a mock test slot
router.delete('/admin/slots/:slotId', adminAuth, async (req, res) => {
  try {
    const { slotId } = req.params;
    const examSlug = req.query.examSlug || req.body.examSlug;
    if (!examSlug) {
      return res.status(400).json({ error: 'examSlug query param or body field is required' });
    }

    const result = await deleteMockSlot(examSlug, slotId);
    res.json(result);
  } catch (err) {
    console.error('Admin delete slot error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete mock slot' });
  }
});

// GET /admin/all-slots — Fetch all slots across all exams
router.get('/admin/all-slots', adminAuth, async (req, res) => {
  try {
    const examFilter = req.query.exam || null;
    const slots = await fetchAllAdminSlots(examFilter);
    res.json({ success: true, slots });
  } catch (err) {
    console.error('Admin fetch all slots error:', err);
    res.status(500).json({ error: 'Failed to fetch admin slots' });
  }
});

// POST /admin/upload-paper — Upload a full Mock Test or PYQ Paper with questions
router.post('/admin/upload-paper', adminAuth, async (req, res) => {
  try {
    const { slot, questions } = req.body;
    if (!slot) {
      return res.status(400).json({ error: 'slot metadata is required' });
    }
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions array is required and must not be empty' });
    }

    const result = await uploadFullPaper({ slotData: slot, questions });
    res.status(201).json(result);
  } catch (err) {
    console.error('Admin upload paper error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload mock test / PYQ paper' });
  }
});

// POST /admin/slots/seed — Explicitly trigger re-seeding default slots
router.post('/admin/slots/seed', adminAuth, async (req, res) => {
  try {
    const result = await seedDefaultSlots();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Admin seed slots error:', err);
    res.status(500).json({ error: 'Failed to seed default slots' });
  }
});

// ─── User Attempt Routes (protect: JWT token) ─────────────

// POST /:examSlug/:testId/start — Start a new mock test attempt
router.post('/:examSlug/:testId/start', protect, async (req, res) => {
  try {
    const { examSlug, testId } = req.params;
    const slot = await fetchSlotById(examSlug, testId);
    if (!slot) return res.status(404).json({ error: 'Test not found' });
    if (slot.examSlug !== examSlug) return res.status(400).json({ error: 'Exam slug mismatch' });

    const { clientPaper, answerKey } = await buildPaper({ examSlug, testId });

    const container = getMockAttemptsContainer();
    const doc = {
      id: uuidv4(),
      userId: req.user.id,
      examSlug,
      testId,
      configKey: slot.configKey,
      status: 'in_progress',
      paper: clientPaper,
      answerKey,
      answers: {},
      sectionTimers: {},
      currentSection: 0,
      startedAt: new Date().toISOString(),
      submittedAt: null,
      result: null,
      weakAreas: null,
    };

    await container.items.create(doc);
    // Don't send answerKey to client
    const { answerKey: _ak, ...clientDoc } = doc;
    res.json({ attemptId: doc.id, ...clientDoc });
  } catch (err) {
    console.error('Start test error:', err);
    res.status(500).json({ error: 'Failed to start test' });
  }
});

// PATCH /attempt/:attemptId/autosave — Autosave progress
router.patch('/attempt/:attemptId/autosave', protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const { answers, sectionTimers, currentSection } = req.body;
    const container = getMockAttemptsContainer();

    let doc;
    try {
      const { resource } = await container.item(attemptId, req.user.id).read();
      doc = resource;
    } catch (err) {
      if (err.code === 404) return res.status(404).json({ error: 'Attempt not found' });
      throw err;
    }
    if (doc.status !== 'in_progress') return res.status(400).json({ error: 'Attempt is not in progress' });

    if (answers) doc.answers = { ...doc.answers, ...answers };
    if (sectionTimers) doc.sectionTimers = { ...doc.sectionTimers, ...sectionTimers };
    if (currentSection !== undefined) doc.currentSection = currentSection;

    await container.item(doc.id, doc.userId).replace(doc);
    res.json({ ok: true });
  } catch (err) {
    console.error('Autosave error:', err);
    res.status(500).json({ error: 'Failed to autosave' });
  }
});

// POST /attempt/:attemptId/submit — Submit and grade attempt
router.post('/attempt/:attemptId/submit', protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const container = getMockAttemptsContainer();

    let doc;
    try {
      const { resource } = await container.item(attemptId, req.user.id).read();
      doc = resource;
    } catch (err) {
      if (err.code === 404) return res.status(404).json({ error: 'Attempt not found' });
      throw err;
    }
    if (doc.status === 'completed') return res.status(400).json({ error: 'Already submitted' });

    // Merge any final answers from body
    if (req.body.answers) doc.answers = { ...doc.answers, ...req.body.answers };

    const result = gradeAttempt({ attemptDoc: doc });
    const percentile = await computePercentile({
      examSlug: doc.examSlug,
      testId: doc.testId,
      score: result.totalScore,
    });

    doc.status = 'completed';
    doc.submittedAt = new Date().toISOString();
    doc.result = { ...result, percentile };

    await container.item(doc.id, doc.userId).replace(doc);

    res.json({ result: doc.result, attemptId: doc.id });
  } catch (err) {
    console.error('Submit error:', err);
    res.status(500).json({ error: 'Failed to submit test' });
  }
});

// GET /attempt/:attemptId — Get attempt details
router.get('/attempt/:attemptId', protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const container = getMockAttemptsContainer();

    let doc;
    try {
      const { resource } = await container.item(attemptId, req.user.id).read();
      doc = resource;
    } catch (err) {
      if (err.code === 404) return res.status(404).json({ error: 'Attempt not found' });
      throw err;
    }

    // Only reveal answerKey after submission
    if (doc.status !== 'completed') {
      const { answerKey, ...safe } = doc;
      return res.json(safe);
    }
    res.json(doc);
  } catch (err) {
    console.error('Get attempt error:', err);
    res.status(500).json({ error: 'Failed to get attempt' });
  }
});

// GET /:examSlug/:testId/history — User's attempts for a specific test
router.get('/:examSlug/:testId/history', protect, async (req, res) => {
  try {
    const { examSlug, testId } = req.params;
    const container = getMockAttemptsContainer();

    const { resources } = await container.items
      .query({
        query: 'SELECT c.id, c.testId, c.examSlug, c.status, c.startedAt, c.submittedAt, c.result FROM c WHERE c.userId = @userId AND c.examSlug = @examSlug AND c.testId = @testId ORDER BY c.startedAt DESC',
        parameters: [
          { name: '@userId', value: req.user.id },
          { name: '@examSlug', value: examSlug },
          { name: '@testId', value: testId },
        ],
      })
      .fetchAll();

    res.json({ attempts: resources });
  } catch (err) {
    console.error('Test history error:', err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// GET /:examSlug/history — User's attempts across all tests for an exam
router.get('/:examSlug/history', protect, async (req, res) => {
  try {
    const { examSlug } = req.params;
    const container = getMockAttemptsContainer();

    const { resources } = await container.items
      .query({
        query: 'SELECT c.id, c.testId, c.examSlug, c.configKey, c.status, c.startedAt, c.submittedAt, c.result FROM c WHERE c.userId = @userId AND c.examSlug = @examSlug ORDER BY c.startedAt DESC',
        parameters: [
          { name: '@userId', value: req.user.id },
          { name: '@examSlug', value: examSlug },
        ],
      })
      .fetchAll();

    res.json({ attempts: resources });
  } catch (err) {
    console.error('Exam history error:', err);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

export default router;
