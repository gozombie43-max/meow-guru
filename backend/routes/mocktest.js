import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { protect } from '../middleware/protect.js';
import adminAuth from '../middleware/auth.js';
import {
  getMockAttemptsCollection,
} from '../config/mongodb.js';
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
import {
  notifyNewMockPublished,
} from '../services/mockPublicationNotificationService.js';

const router = express.Router();

const cleanAttempt = (doc) => {
  if (!doc) return doc;

  const {
    _id,
    _cosmosRid,
    ...clean
  } = doc;

  return clean;
};

async function getOwnedAttempt(
  attemptId,
  userId
) {
  return getMockAttemptsCollection()
    .findOne({
      id: String(attemptId),
      userId: String(userId),
    });
}

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
    const {
      id,
      examSlug,
      configKey,
      title,
      tier,
      type = "mock",
      isFree,
      order,
    } = req.body;
    if (!id || !examSlug || !configKey || !title) {
      return res.status(400).json({ error: 'id, examSlug, configKey, and title are required' });
    }

    const createdSlot = await createMockSlot({
      id,
      examSlug,
      configKey,
      title,
      tier,
      type,
      isFree,
      order,
    });

    if (createdSlot.type === "mock") {
      void notifyNewMockPublished({
        id: createdSlot.id,
        examSlug: createdSlot.examSlug,
        title: createdSlot.title,
        tier: createdSlot.tier,
        type: createdSlot.type,
      }).catch((error) => {
        console.error("Dynamic mock notification failed:", error);
      });
    }

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

    if (result.isNewSlot && result.type === "mock") {
      void notifyNewMockPublished({
        id: result.slotId,
        examSlug: result.examSlug,
        title: result.title,
        tier: result.tier,
        type: result.type,
      }).catch((error) => {
        console.error("New mock notification trigger failed:", error);
      });
    }

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
    const startedAt = new Date();
    const durationSeconds = Math.max(60, Math.round((Number(clientPaper.totalDurationMin) || 60) * 60));
    const deadlineAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const doc = {
      id: uuidv4(),
      userId: String(req.user.id),
      examSlug,
      testId,
      configKey: slot.configKey,
      status: 'in_progress',
      paper: clientPaper,
      answerKey,
      answers: {},
      questionStatuses: {},
      sectionTimers: {},
      currentSection: 0,
      currentQuestion: 0,
      revision: 0,
      startedAt,
      deadlineAt,
      submittedAt: null,
      result: null,
      weakAreas: null,
    };

    await getMockAttemptsCollection().insertOne(doc);
    const { answerKey: _answerKey, ...clientDoc } = cleanAttempt(doc);
    return res.status(201).json({ attemptId: doc.id, ...clientDoc, timeLeft: durationSeconds });
  } catch (err) {
    console.error('Start test error:', err);
    return res.status(500).json({ error: 'Failed to start test' });
  }
});

// PATCH /attempt/:attemptId/autosave — Autosave progress
router.patch('/attempt/:attemptId/autosave', protect, async (req, res) => {
  try {
    const { attemptId } = req.params;
    const doc = await getOwnedAttempt(attemptId, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Attempt not found' });
    if (doc.status !== 'in_progress') return res.status(409).json({ error: 'Attempt is not in progress' });

    const deadlineMs = Date.parse(doc.deadlineAt);
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs + 30_000) {
      return res.status(409).json({ error: 'Attempt time has expired', expired: true });
    }

    const revision = Number(req.body.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) {
      return res.status(400).json({ error: 'A positive autosave revision is required' });
    }
    const questionIds = new Set((doc.paper?.sections || []).flatMap(section => section.questions || []).map(question => String(question.id)));
    const sanitizeMap = (value) => Object.fromEntries(
      Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
        .filter(([key]) => questionIds.has(String(key)))
    );
    const sectionCount = doc.paper?.sections?.length || 1;
    const currentSection = Math.max(0, Math.min(sectionCount - 1, Number(req.body.currentSection) || 0));
    const questionCount = doc.paper?.sections?.[currentSection]?.questions?.length || 1;
    const currentQuestion = Math.max(0, Math.min(questionCount - 1, Number(req.body.currentQuestion) || 0));

    const result = await getMockAttemptsCollection().updateOne(
      {
        _id: doc._id,
        status: 'in_progress',
        $or: [{ revision: { $lt: revision } }, { revision: { $exists: false } }],
      },
      {
        $set: {
          answers: sanitizeMap(req.body.answers),
          questionStatuses: sanitizeMap(req.body.questionStatuses),
          sectionTimers: req.body.sectionTimers && typeof req.body.sectionTimers === 'object' ? req.body.sectionTimers : {},
          currentSection,
          currentQuestion,
          revision,
          updatedAt: new Date(),
        },
      },
    );

    return res.json({ ok: true, revision: Math.max(Number(doc.revision) || 0, result.modifiedCount ? revision : 0) });
  } catch (err) {
    console.error('Autosave error:', err);
    return res.status(500).json({ error: 'Failed to autosave' });
  }
});

// POST /attempt/:attemptId/submit — Submit and grade attempt
router.post('/attempt/:attemptId/submit', protect, async (req, res) => {
  const attempts = getMockAttemptsCollection();
  let claimed = null;
  try {
    claimed = await attempts.findOneAndUpdate(
      { id: String(req.params.attemptId), userId: String(req.user.id), status: 'in_progress' },
      { $set: { status: 'submitting', submitClaimedAt: new Date() } },
      { returnDocument: 'after' },
    );
    if (!claimed) {
      const existing = await getOwnedAttempt(req.params.attemptId, req.user.id);
      if (!existing) return res.status(404).json({ error: 'Attempt not found' });
      if (existing.status === 'completed') return res.json({ result: existing.result, attemptId: existing.id, idempotent: true });
      return res.status(409).json({ error: 'Attempt submission is already processing' });
    }

    const result = gradeAttempt({ attemptDoc: claimed });
    const percentile = await computePercentile({
      examSlug: claimed.examSlug,
      testId: claimed.testId,
      score: result.totalScore,
    });
    const finalResult = { ...result, percentile };
    const submittedAt = new Date();

    await attempts.updateOne(
      { _id: claimed._id, status: 'submitting' },
      { $set: { status: 'completed', submittedAt, result: finalResult }, $unset: { submitClaimedAt: '' } },
    );
    return res.json({ result: finalResult, attemptId: claimed.id });
  } catch (err) {
    if (claimed?._id) {
      await attempts.updateOne(
        { _id: claimed._id, status: 'submitting' },
        { $set: { status: 'in_progress', updatedAt: new Date() }, $unset: { submitClaimedAt: '' } },
      ).catch((rollbackError) => console.error('Submit rollback error:', rollbackError));
    }
    console.error('Submit error:', err);
    return res.status(500).json({ error: 'Failed to submit test' });
  }
});

// GET /attempt/:attemptId — Get attempt details
router.get(
  '/attempt/:attemptId',
  protect,
  async (req, res) => {
    try {
      const doc =
        await getOwnedAttempt(
          req.params.attemptId,
          req.user.id
        );

      if (!doc) {
        return res
          .status(404)
          .json({
            error: 'Attempt not found',
          });
      }

      const clean =
        cleanAttempt(doc);

      if (clean.status !== 'completed') {
        const {
          answerKey,
          ...safe
        } = clean;

        const deadline = safe.deadlineAt ? new Date(safe.deadlineAt).getTime() : Date.now();
        return res.json({
          ...safe,
          timeLeft: Math.max(0, Math.floor((deadline - Date.now()) / 1000)),
        });
      }

      return res.json(clean);
    } catch (err) {
      console.error(
        'Get attempt error:',
        err
      );

      return res
        .status(500)
        .json({
          error: 'Failed to get attempt',
        });
    }
  }
);

// GET /:examSlug/:testId/history — User's attempts for a specific test
router.get(
  '/:examSlug/:testId/history',
  protect,
  async (req, res) => {
    try {
      const {
        examSlug,
        testId,
      } = req.params;

      const resources =
        await getMockAttemptsCollection()
          .find(
            {
              userId: String(req.user.id),
              examSlug,
              testId,
            },
            {
              projection: {
                _id: 0,
                _cosmosRid: 0,
                id: 1,
                testId: 1,
                examSlug: 1,
                status: 1,
                startedAt: 1,
                submittedAt: 1,
                result: 1,
              },
            }
          )
          .sort({
            startedAt: -1,
          })
          .limit(100)
          .toArray();

      return res.json({
        attempts: resources,
      });
    } catch (err) {
      console.error(
        'Test history error:',
        err
      );

      return res
        .status(500)
        .json({
          error: 'Failed to get history',
        });
    }
  }
);

// GET /:examSlug/history — User's attempts across all tests for an exam
router.get(
  '/:examSlug/history',
  protect,
  async (req, res) => {
    try {
      const { examSlug } =
        req.params;

      const resources =
        await getMockAttemptsCollection()
          .find(
            {
              userId: String(req.user.id),
              examSlug,
            },
            {
              projection: {
                _id: 0,
                _cosmosRid: 0,
                id: 1,
                testId: 1,
                examSlug: 1,
                configKey: 1,
                status: 1,
                startedAt: 1,
                submittedAt: 1,
                result: 1,
              },
            }
          )
          .sort({
            startedAt: -1,
          })
          .limit(100)
          .toArray();

      return res.json({
        attempts: resources,
      });
    } catch (err) {
      console.error(
        'Exam history error:',
        err
      );

      return res
        .status(500)
        .json({
          error: 'Failed to get history',
        });
    }
  }
);
export default router;
