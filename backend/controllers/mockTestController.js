import { v4 as uuidv4 } from 'uuid';
import { activePaper } from '../services/mockTestPresentation.js';
import { validateAssessment } from '../services/assessmentPolicy.js';
import { mockAnswerIndex } from '../services/mockAnswer.js';
import {
  getOwnedAttempt,
  getAttemptByStartKey,
  getConfidentialAttempt,
  insertAttempt,
  updateAttemptProgress,
  submitAttemptUpdate,
  getTestHistory,
  getExamHistory
} from '../repositories/mockTestRepository.js';
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
  summarizeSlot,
} from '../services/mockTestEngine.js';
import { notifyNewMockPublished } from '../services/mockPublicationNotificationService.js';

const cleanAttempt = (doc) => {
  if (!doc) return doc;
  const { _id, _cosmosRid, ...clean } = doc;
  return clean;
};

function presentAttempt(doc) {
  const clean = cleanAttempt(doc);
  const timeLeft = Math.max(0, Math.floor((new Date(doc.deadlineAt).getTime() - Date.now()) / 1000));
  if (doc.status === 'completed' && doc.assessmentMode !== 'confidential') {
    const answerKey = { ...clean.answerKey };
    for (const question of (doc.paper?.sections || []).flatMap(section => section.questions || [])) {
      const index = mockAnswerIndex(answerKey[question.id], question.options);
      if (index !== null) answerKey[question.id] = String(question.options[index]?.id ?? index);
    }
    return { ...clean, answerKey, attemptId: doc.id, timeLeft };
  }
  const { answerKey: _key, ...safe } = clean;
  return { ...safe, attemptId: doc.id, paper: activePaper(safe.paper), timeLeft };
}

export const fetchExamSlots = async (req, res) => {
  try {
    const { examSlug } = req.params;
    const slots = await fetchSlotsForExam(examSlug);
    res.json({ slots });
  } catch (err) {
    console.error('Fetch slots error:', err);
    res.status(500).json({ error: 'Failed to fetch mock test slots' });
  }
};

export const fetchSingleSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const examSlug = req.query.examSlug;
    const slot = await fetchSlotById(examSlug, slotId);
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json({ slot: summarizeSlot(slot) });
  } catch (err) {
    console.error('Fetch single slot error:', err);
    res.status(500).json({ error: 'Failed to fetch slot details' });
  }
};

export const adminCreateSlot = async (req, res) => {
  try {
    const { id, examSlug, configKey, title, tier, type = "mock", isFree, order, assessmentMode } = req.body;
    if (!id || !examSlug || !configKey || !title) {
      return res.status(400).json({ error: 'id, examSlug, configKey, and title are required' });
    }
    const createdSlot = await createMockSlot({ id, examSlug, configKey, title, tier, type, isFree, order, assessmentMode });
    if (createdSlot.type === "mock") {
      void notifyNewMockPublished({ id: createdSlot.id, examSlug: createdSlot.examSlug, title: createdSlot.title, tier: createdSlot.tier, type: createdSlot.type }).catch(console.error);
    }
    res.status(201).json({ success: true, slot: createdSlot });
  } catch (err) {
    console.error('Admin create slot error:', err);
    res.status(500).json({ error: err.message || 'Failed to create mock slot' });
  }
};

export const adminUpdateSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const { examSlug, ...updates } = req.body;
    if (!examSlug) return res.status(400).json({ error: 'examSlug is required in body to locate the partition' });
    const updatedSlot = await updateMockSlot(examSlug, slotId, updates);
    res.json({ success: true, slot: updatedSlot });
  } catch (err) {
    console.error('Admin update slot error:', err);
    res.status(500).json({ error: err.message || 'Failed to update mock slot' });
  }
};

export const adminDeleteSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const examSlug = req.query.examSlug || req.body.examSlug;
    if (!examSlug) return res.status(400).json({ error: 'examSlug query param or body field is required' });
    const result = await deleteMockSlot(examSlug, slotId);
    res.json(result);
  } catch (err) {
    console.error('Admin delete slot error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete mock slot' });
  }
};

export const adminFetchAllSlots = async (req, res) => {
  try {
    const examFilter = req.query.exam || null;
    const slots = await fetchAllAdminSlots(examFilter);
    res.json({ success: true, slots });
  } catch (err) {
    console.error('Admin fetch all slots error:', err);
    res.status(500).json({ error: 'Failed to fetch admin slots' });
  }
};

export const adminUploadPaper = async (req, res) => {
  try {
    const { slot, questions } = req.body;
    if (!slot) return res.status(400).json({ error: 'slot metadata is required' });
    if (!Array.isArray(questions) || questions.length === 0) return res.status(400).json({ error: 'questions array is required and must not be empty' });
    const result = await uploadFullPaper({ slotData: slot, questions });
    if (result.isNewSlot && result.type === "mock") {
      void notifyNewMockPublished({ id: result.slotId, examSlug: result.examSlug, title: result.title, tier: result.tier, type: result.type }).catch(console.error);
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('Admin upload paper error:', err);
    res.status(500).json({ error: err.message || 'Failed to upload mock test / PYQ paper' });
  }
};

export const adminSeedSlots = async (req, res) => {
  try {
    const result = await seedDefaultSlots();
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Admin seed slots error:', err);
    res.status(500).json({ error: 'Failed to seed default slots' });
  }
};

export const startMockTest = async (req, res) => {
  try {
    const { examSlug, testId } = req.params;
    const startKey = req.get('Idempotency-Key');
    if (startKey && !/^[a-zA-Z0-9_-]{8,100}$/.test(startKey)) return res.status(400).json({ error: 'Invalid Idempotency-Key' });
    if (startKey) {
      const previous = await getAttemptByStartKey(req.user.id, startKey);
      if (previous) {
        if (previous.examSlug !== examSlug || previous.testId !== testId) return res.status(409).json({ error: 'Idempotency key belongs to another test' });
        return res.json(presentAttempt(previous));
      }
    }
    const slot = await fetchSlotById(examSlug, testId);
    if (!slot) return res.status(404).json({ error: 'Test not found' });
    if (slot.examSlug !== examSlug) return res.status(400).json({ error: 'Exam slug mismatch' });
    if (slot.assessmentMode === 'confidential') {
      const previous = await getConfidentialAttempt(req.user.id, examSlug, testId);
      if (previous) return res.json(presentAttempt(previous));
    }

    const { clientPaper, answerKey } = await buildPaper({ examSlug, testId });
    validateAssessment(slot, clientPaper, answerKey);
    if (slot.assessmentMode === 'confidential') clientPaper.compositeTimer = true;
    clientPaper.sections = clientPaper.sections.filter(section => section.questions.length > 0);
    const startedAt = new Date();
    const durationSeconds = Math.max(60, Math.round((Number(clientPaper.totalDurationMin) || 60) * 60));
    const deadlineAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const doc = {
      id: uuidv4(),
      userId: String(req.user.id),
      examSlug,
      testId,
      configKey: slot.configKey,
      assessmentMode: slot.assessmentMode || 'practice',
      ...(startKey ? { startKey } : {}),
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

    try { await insertAttempt(doc); }
    catch (error) {
      if (error.code !== 11000) throw error;
      const previous = slot.assessmentMode === 'confidential'
        ? await getConfidentialAttempt(req.user.id, examSlug, testId)
        : await getAttemptByStartKey(req.user.id, startKey);
      if (!previous || previous.examSlug !== examSlug || previous.testId !== testId) return res.status(409).json({ error: 'Idempotency key conflict' });
      return res.json(presentAttempt(previous));
    }
    return res.status(201).json(presentAttempt(doc));
  } catch (err) {
    console.error('Start test error:', err);
    return res.status(err.statusCode || 500).json({ error: err.statusCode ? err.message : 'Failed to start test' });
  }
};

export const autosaveAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const doc = await getOwnedAttempt(attemptId, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Attempt not found' });
    if (doc.status !== 'in_progress') return res.status(409).json({ error: 'Attempt is not in progress', code: 'ATTEMPT_NOT_IN_PROGRESS' });

    const deadlineMs = Date.parse(doc.deadlineAt);
    const graceMs = doc.assessmentMode === 'confidential' ? 0 : 30_000;
    if (Number.isFinite(deadlineMs) && Date.now() > deadlineMs + graceMs) {
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
    const currentSection = Math.max(0, Math.min(sectionCount - 1, Math.floor(Number(req.body.currentSection)) || 0));
    const questionCount = doc.paper?.sections?.[currentSection]?.questions?.length || 1;
    const currentQuestion = Math.max(0, Math.min(questionCount - 1, Math.floor(Number(req.body.currentQuestion)) || 0));

    const filter = {
      _id: doc._id,
      status: 'in_progress',
      ...(Number.isFinite(deadlineMs) ? { deadlineAt: { $gte: new Date(Date.now() - graceMs) } } : {}),
      ...(req.body.baseRevision !== undefined ? { revision: Number(req.body.baseRevision) } : {}),
      $or: [{ revision: { $lt: revision } }, { revision: { $exists: false } }],
    };
    
    const update = {
      $set: {
        answers: sanitizeMap(req.body.answers),
        questionStatuses: sanitizeMap(req.body.questionStatuses),
        sectionTimers: req.body.sectionTimers && typeof req.body.sectionTimers === 'object' ? req.body.sectionTimers : {},
        currentSection,
        currentQuestion,
        revision,
        updatedAt: new Date(),
      },
    };
    const result = await updateAttemptProgress(filter, update);

    if (!result.modifiedCount && req.body.baseRevision !== undefined) {
      const latest = await getOwnedAttempt(attemptId, req.user.id);
      return res.status(409).json({ error: 'Progress changed in another tab. Reload this attempt before continuing.', code: 'REVISION_CONFLICT', revision: latest?.revision });
    }
    return res.json({ ok: true, revision: Math.max(Number(doc.revision) || 0, result.modifiedCount ? revision : 0) });
  } catch (err) {
    console.error('Autosave error:', err);
    return res.status(500).json({ error: 'Failed to autosave' });
  }
};

export const submitAttemptHandler = async (req, res) => {
  try {
    const claimed = await getOwnedAttempt(req.params.attemptId, req.user.id);
    if (!claimed) return res.status(404).json({ error: 'Attempt not found' });
    if (claimed.status === 'completed') return res.json({ result: claimed.result, attemptId: claimed.id, idempotent: true });
    if (!['in_progress', 'submitting'].includes(claimed.status)) return res.status(409).json({ error: 'Attempt cannot be submitted' });

    const result = gradeAttempt({ attemptDoc: claimed });
    const percentile = await computePercentile({ examSlug: claimed.examSlug, testId: claimed.testId, score: result.totalScore });
    const finalResult = { ...result, percentile };
    const submittedAt = new Date();

    const filter = { _id: claimed._id, status: claimed.status, revision: claimed.revision ?? { $exists: false } };
    const update = { $set: { status: 'completed', submittedAt, result: finalResult }, $unset: { submitClaimedAt: '' } };
    const saved = await submitAttemptUpdate(filter, update);
    
    if (!saved.modifiedCount) {
      const existing = await getOwnedAttempt(req.params.attemptId, req.user.id);
      if (existing?.status === 'completed') return res.json({ result: existing.result, attemptId: existing.id, idempotent: true });
      return res.status(409).json({ error: 'Progress changed during submission. Please retry.' });
    }
    return res.json({ result: finalResult, attemptId: claimed.id });
  } catch (err) {
    console.error('Submit error:', err);
    return res.status(500).json({ error: 'Failed to submit test' });
  }
};

export const getAttemptDetails = async (req, res) => {
  try {
    const doc = await getOwnedAttempt(req.params.attemptId, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Attempt not found' });

    const clean = cleanAttempt(doc);
    if (clean.status !== 'completed' || clean.assessmentMode === 'confidential') {
      const { answerKey, ...safe } = clean;
      const deadline = safe.deadlineAt ? new Date(safe.deadlineAt).getTime() : Date.now();
      return res.json({
        ...safe,
        paper: activePaper(safe.paper),
        timeLeft: Math.max(0, Math.floor((deadline - Date.now()) / 1000)),
      });
    }

    return res.json(presentAttempt(doc));
  } catch (err) {
    console.error('Get attempt error:', err);
    return res.status(500).json({ error: 'Failed to get attempt' });
  }
};

export const getTestHistoryHandler = async (req, res) => {
  try {
    const { examSlug, testId } = req.params;
    const resources = await getTestHistory(req.user.id, examSlug, testId);
    return res.json({ attempts: resources });
  } catch (err) {
    console.error('Test history error:', err);
    return res.status(500).json({ error: 'Failed to get history' });
  }
};

export const getExamHistoryHandler = async (req, res) => {
  try {
    const { examSlug } = req.params;
    const resources = await getExamHistory(req.user.id, examSlug);
    return res.json({ attempts: resources });
  } catch (err) {
    console.error('Exam history error:', err);
    return res.status(500).json({ error: 'Failed to get history' });
  }
};
