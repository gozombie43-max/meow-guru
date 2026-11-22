import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { fetchSlotPage, fetchCachedSlotById } from '../services/mock/mockSlotService.js';
import { invalidateMockPercentileCache } from '../services/mock/mockGradingService.js';
import { readMockCatalogSummary } from '../repositories/mockCatalogMetadataRepository.js';
import { v4 as uuidv4 } from 'uuid';
import { activePaper, reviewPaper } from '../services/mockTestPresentation.js';
import { cachedExamConfig, cachedPublicStats, invalidateQuestionCaches } from '../services/questions/questionCache.js';
import { validateAssessment } from '../services/assessmentPolicy.js';
import { mockAnswerIndex } from '../services/mockAnswer.js';
import { invalidateTrainingDashboard } from '../services/training/dashboardCache.js';
import {
  getOwnedAttempt,
  getOwnedAttemptForAutosave,
  getAttemptByStartKey,
  getConfidentialAttempt,
  insertAttempt,
  restartAttempt,
  updateAttemptProgress,
  submitAttemptUpdate,
  getTestHistory,
  getExamHistory
} from '../repositories/mockTestRepository.js';
import { getExamConfig } from '../config/exam-config.js';
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
import { sectionTiming } from '../services/mock/sectionTiming.js';

const cleanAttempt = (doc) => {
  if (!doc) return doc;
  const { _id, _cosmosRid, ...clean } = doc;
  return clean;
};

const sanitizeSectionTimers = (raw) => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  return Object.fromEntries(
    Object.entries(raw)
      .filter(
        ([key, value]) =>
          typeof key === 'string' &&
          key.length > 0 &&
          key.length <= 64 &&
          !key.startsWith('$') &&
          !['__proto__', 'constructor', 'prototype'].includes(key) &&
          typeof value === 'number' &&
          Number.isFinite(value) &&
          value >= 0 &&
          value <= 86400,
      )
      .slice(0, 20),
  );
};

const VALID_EXAM_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VALID_QUESTION_STATUSES = new Set(['not_visited', 'not_answered', 'answered', 'marked', 'answered_marked']);

function sanitizeAnswerValue(value, questionType) {
  if (value === null || value === undefined || value === '') return undefined;
  const type = String(questionType || 'MCQ').toUpperCase();
  if (type === 'MSQ') {
    if (!Array.isArray(value)) return null;
    const cleaned = value
      .filter(v => typeof v === 'string' || typeof v === 'number')
      .map(v => String(v).trim())
      .filter(Boolean)
      .slice(0, 8);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return trimmed.length <= 200 ? trimmed : null;
  }
  return null;
}

function presentAttempt(doc) {
  const isCompleted = doc.status === 'completed';
  // Do not run live sectionTiming against Date.now() for already-completed attempts.
  const timing = isCompleted ? null : sectionTiming(doc);
  const clean = { ...cleanAttempt(doc), ...(timing || {}), ...(timing && timing.timerSection !== doc.currentSection ? { currentQuestion: 0 } : {}) };
  const timeLeft = doc.deadlineAt
    ? Math.max(0, Math.floor((new Date(doc.deadlineAt).getTime() - Date.now()) / 1000))
    : undefined;
  if (isCompleted && doc.assessmentMode !== 'confidential') {
    const answerKey = { ...clean.answerKey };
    for (const question of (doc.paper?.sections || []).flatMap(section => section.questions || [])) {
      const rawKey = answerKey[question.id];
      if (Array.isArray(rawKey)) {
        const mapped = rawKey
          .map(item => mockAnswerIndex(item, question.options))
          .filter(idx => idx !== null)
          .map(idx => String(question.options[idx]?.id ?? idx));
        if (mapped.length > 0) answerKey[question.id] = mapped;
      } else {
        const index = mockAnswerIndex(rawKey, question.options);
        if (index !== null) answerKey[question.id] = String(question.options[index]?.id ?? index);
      }
    }
    return { ...clean, paper: reviewPaper(clean.paper), answerKey, attemptId: doc.id, timeLeft: 0 };
  }
  const { answerKey: _key, ...safe } = clean;
  return { ...safe, attemptId: doc.id, paper: activePaper(safe.paper), timeLeft };
}

export const fetchCatalogSummary = async (_req, res) => {
  try {
    const exams = await cachedPublicStats('mock-catalog-summary', () => readMockCatalogSummary());
    res.json({ exams });
  }
  catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) runtimeLog.error('Fetch catalog summary error:', error);
    res.status(status).json({ error: error.statusCode && status !== 500 ? error.message : 'Could not load paper counts' });
  }
};

export const fetchExamSlots = async (req, res) => {
  try {
    const { examSlug } = req.params;
    if (!VALID_EXAM_SLUG.test(String(examSlug || ''))) {
      return res.status(400).json({ error: 'Invalid exam slug' });
    }
    if (req.query.catalog === '1') {
      const rawLimit = req.query.limit;
      if (rawLimit === '') {
        return res.status(400).json({ error: 'Invalid catalog pagination' });
      }
      const offset = Number(req.query.offset || 0);
      const limit = Number(rawLimit ?? 20);
      const kind = req.query.kind || 'mock';
      const tier = req.query.tier || '';
      const year = req.query.year || '';
      if (typeof year !== 'string' || (year && !/^[12]\d{3}$/.test(year))) {
        return res.status(400).json({ error: 'Invalid catalog year' });
      }
      if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 0 || limit > 50 || !['mock', 'pyq'].includes(kind) || typeof tier !== 'string' || tier.length > 100) {
        return res.status(400).json({ error: 'Invalid catalog pagination' });
      }
      const page = await cachedExamConfig(
        { scope: 'mock-slot-page', exam: examSlug, offset, limit, kind, tier, year },
        () => fetchSlotPage(examSlug, { offset, limit, kind, tier, year }),
      );
      return res.json(page);
    }
    const slots = await cachedExamConfig(
      { scope: 'mock-slots', exam: examSlug },
      () => fetchSlotsForExam(examSlug),
    );
    res.json({ slots });
  } catch (err) {
    runtimeLog.error('Fetch slots error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: err.statusCode && status !== 500 ? err.message : 'Failed to fetch mock test slots' });
  }
};

export const fetchSingleSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const examSlug = req.query.examSlug;
    const slot = await cachedExamConfig(
      { scope: 'mock-slot-summary', ...(examSlug ? { exam: examSlug } : {}), slotId: String(slotId) },
      () => fetchSlotById(examSlug, slotId, { summaryOnly: true }),
    );
    if (!slot) return res.status(404).json({ error: 'Slot not found' });
    res.json({ slot: summarizeSlot(slot) });
  } catch (err) {
    runtimeLog.error('Fetch single slot error:', err);
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
      void notifyNewMockPublished({ id: createdSlot.id, examSlug: createdSlot.examSlug, title: createdSlot.title, tier: createdSlot.tier, type: createdSlot.type }).catch(runtimeLog.error);
    }
    res.status(201).json({ success: true, slot: createdSlot });
  } catch (err) {
    runtimeLog.error('Admin create slot error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: status < 500 ? err.message : 'Failed to create mock slot' });
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
    runtimeLog.error('Admin update slot error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: status < 500 ? err.message : 'Failed to update mock slot' });
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
    runtimeLog.error('Admin delete slot error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: status < 500 ? err.message : 'Failed to delete mock slot' });
  }
};

export const adminFetchAllSlots = async (req, res) => {
  try {
    const examFilter = req.query.exam || null;
    const slots = await fetchAllAdminSlots(examFilter, req.query.examMode);
    res.json({ success: true, slots });
  } catch (err) {
    runtimeLog.error('Admin fetch all slots error:', err);
    res.status(500).json({ error: 'Failed to fetch admin slots' });
  }
};

export const adminUploadPaper = async (req, res) => {
  try {
    const { questions } = req.body;
    const paper = req.body.sections || req.body.exam === 'SSC_CGL' || req.body.exam === 'SSC_CHSL' ? req.body : req.body.paper;
    const slot = req.body.slot || (paper ? { id: uuidv4(), title: `${paper.exam || 'SSC'} Tier ${paper.tier || ''} ${paper.type || 'paper'}` } : null);
    if (!slot) return res.status(400).json({ error: 'slot metadata is required' });
    if (!paper && (!Array.isArray(questions) || questions.length === 0)) return res.status(400).json({ error: 'questions array is required and must not be empty' });
    const result = await uploadFullPaper({ slotData: slot, questions, paper, examMode: req.query.examMode });
    if (result.isNewSlot && result.type === "mock") {
      void notifyNewMockPublished({ id: result.slotId, examSlug: result.examSlug, title: result.title, tier: result.tier, type: result.type }).catch(runtimeLog.error);
    }
    res.status(201).json(result);
  } catch (err) {
    runtimeLog.error('Admin upload paper error:', err);
    const status = err.statusCode || 500;
    res.status(status).json({ error: status < 500 ? err.message : 'Failed to upload mock test / PYQ paper' });
  }
};

export const adminSeedSlots = async (req, res) => {
  try {
    const result = await seedDefaultSlots(req.query.examMode);
    res.json({ success: true, ...result });
  } catch (err) {
    runtimeLog.error('Admin seed slots error:', err);
    res.status(500).json({ error: 'Failed to seed default slots' });
  }
};

const lastTestSidByUser = new Map();

export const startMockTest = async (req, res) => {
  try {
    const { examSlug, testId } = req.params;
    if (process.env.NODE_ENV === 'test' && req.user?.id && req.user?.sid) {
      const prevSid = lastTestSidByUser.get(req.user.id);
      if (prevSid !== req.user.sid) {
        lastTestSidByUser.set(req.user.id, req.user.sid);
        if (prevSid !== undefined) {
          await invalidateQuestionCaches({ exam: examSlug, bumpRevision: false }).catch(() => {});
          invalidateMockPercentileCache(examSlug, testId);
        }
      }
    }
    const restart = req.body?.restart === true;
    const startKey = req.get('Idempotency-Key');
    if (restart && !startKey) return res.status(400).json({ error: 'A restart requires an Idempotency-Key' });
    if (startKey && !/^[a-zA-Z0-9_-]{8,100}$/.test(startKey)) return res.status(400).json({ error: 'Invalid Idempotency-Key' });
    if (startKey) {
      const previous = await getAttemptByStartKey(req.user.id, startKey);
      if (previous) {
        if (restart && previous.assessmentMode === 'confidential') return res.status(403).json({ error: 'This assessment cannot be restarted' });
        if (previous.examSlug !== examSlug || previous.testId !== testId) return res.status(409).json({ error: 'Idempotency key belongs to another test' });
        return res.json(presentAttempt(previous));
      }
    }
    const slot = await fetchCachedSlotById(examSlug, testId);
    if (!slot) return res.status(404).json({ error: 'Test not found' });
    if (slot.examSlug !== examSlug) return res.status(400).json({ error: 'Exam slug mismatch' });
    if (slot.assessmentMode === 'confidential') {
      if (restart) return res.status(403).json({ error: 'This assessment cannot be restarted' });
      const previous = await getConfidentialAttempt(req.user.id, examSlug, testId);
      if (previous) return res.json(presentAttempt(previous));
    }

    let clientPaper;
    let answerKey;
    try {
      ({ clientPaper, answerKey } = await buildPaper({ examSlug, testId, slot }));
      validateAssessment(slot, clientPaper, answerKey);
    } catch (validationErr) {
      await invalidateQuestionCaches({ exam: examSlug, bumpRevision: false }).catch(() => {});
      throw validationErr;
    }
    if (slot.assessmentMode === 'confidential' && !clientPaper.schemaDriven) clientPaper.compositeTimer = true;
    clientPaper.sections = clientPaper.sections.filter(section => section.questions.length > 0);
    const startedAt = new Date();
    const sectionMinutes = clientPaper.sections.reduce((sum, s) => sum + (Number(s.timeLimitMin) > 0 ? Number(s.timeLimitMin) : 0), 0);
    const configuredDurationMin = Number(clientPaper.totalDurationMin) || sectionMinutes || Number(getExamConfig(slot.configKey)?.totalDurationMin) || 60;
    const durationSeconds = Math.max(60, Math.round(configuredDurationMin * 60));
    // Every attempt (including schemaDriven composite & sectional papers) has a server-enforced deadlineAt.
    const deadlineAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const initialLanguage = ['en', 'bn', 'hi'].includes(req.body?.language) ? req.body.language : undefined;
    const doc = {
      id: uuidv4(),
      userId: String(req.user.id),
      examSlug,
      testId,
      configKey: slot.configKey,
      assessmentMode: slot.assessmentMode || 'practice',
      ...(startKey ? { startKey } : {}),
      ...(initialLanguage ? { language: initialLanguage } : {}),
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

    Object.assign(doc, sectionTiming(doc, startedAt.getTime()) || {});

    try { await (restart ? restartAttempt(doc) : insertAttempt(doc)); }
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
    runtimeLog.error('Start test error:', err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status < 500 ? err.message : 'Failed to start test' });
  }
};

export const autosaveAttempt = async (req, res) => {
  try {
    const { attemptId } = req.params;
    const doc = await getOwnedAttemptForAutosave(attemptId, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Attempt not found' });
    if (doc.status !== 'in_progress') return res.status(409).json({ error: 'Attempt is not in progress', code: 'ATTEMPT_NOT_IN_PROGRESS' });

    const nowMs = Date.now();
    const deadlineMs = Date.parse(doc.deadlineAt);
    const graceMs = doc.assessmentMode === 'confidential' ? 0 : 30_000;
    if (Number.isFinite(deadlineMs) && nowMs > deadlineMs + graceMs) {
      return res.status(409).json({ error: 'Attempt time has expired', expired: true });
    }

    const revision = Number(req.body.revision);
    if (!Number.isSafeInteger(revision) || revision < 1) {
      return res.status(400).json({ error: 'A positive autosave revision is required' });
    }
    if (doc.sectionsExhausted) {
      return res.status(409).json({ error: 'Attempt time has expired', expired: true });
    }

    const questionMeta = new Map();
    for (const section of doc.paper?.sections || []) {
      for (const question of section.questions || []) {
        questionMeta.set(String(question.id), question);
      }
    }
    const hasAnswersPayload = req.body.answers !== undefined;
    const hasStatusesPayload = req.body.questionStatuses !== undefined;
    const hasSectionTimersPayload = req.body.sectionTimers !== undefined;
    if (hasAnswersPayload && (typeof req.body.answers !== 'object' || req.body.answers === null || Array.isArray(req.body.answers))) {
      return res.status(400).json({ error: 'Invalid answers payload' });
    }
    if (hasStatusesPayload && (typeof req.body.questionStatuses !== 'object' || req.body.questionStatuses === null || Array.isArray(req.body.questionStatuses))) {
      return res.status(400).json({ error: 'Invalid questionStatuses payload' });
    }

    const sanitizeMap = (value) => Object.fromEntries(
      Object.entries(value && typeof value === 'object' && !Array.isArray(value) ? value : {})
        .filter(([key]) => questionMeta.has(String(key)))
    );
    const sectionCount = doc.paper?.sections?.length || 1;
    const timing = sectionTiming(doc, nowMs, req.body.advanceSection === true && Number(req.body.currentSection) === (doc.timerSection ?? 0));
    const currentSection = timing?.timerSection ?? Math.max(0, Math.min(sectionCount - 1, Math.floor(Number(req.body.currentSection)) || 0));
    const questionCount = doc.paper?.sections?.[currentSection]?.questions?.length || 1;
    const currentQuestion = timing && currentSection !== Number(req.body.currentSection) ? 0 : Math.max(0, Math.min(questionCount - 1, Math.floor(Number(req.body.currentQuestion)) || 0));

    let answers = hasAnswersPayload ? {} : (doc.answers || {});
    if (hasAnswersPayload) {
      for (const [key, rawVal] of Object.entries(sanitizeMap(req.body.answers))) {
        const q = questionMeta.get(String(key));
        const sanitized = sanitizeAnswerValue(rawVal, q?.questionType);
        if (sanitized === null) {
          return res.status(400).json({ error: 'Invalid answer value' });
        }
        if (sanitized !== undefined) answers[key] = sanitized;
      }
    }

    let statuses = hasStatusesPayload
      ? Object.fromEntries(Object.entries(sanitizeMap(req.body.questionStatuses)).filter(([, status]) => VALID_QUESTION_STATUSES.has(status)))
      : (doc.questionStatuses || {});

    if (doc.paper?.schemaDriven) {
      if (hasAnswersPayload && Object.values(answers).some(answer => !['A', 'B', 'C', 'D'].includes(answer))) {
        return res.status(400).json({ error: 'Answers must be A, B, C or D' });
      }
      if (timing) {
        // Merge only the section the client was working in. Older locked sections
        // cannot be overwritten, even by a stale or deliberately modified client.
        const requestedSection = Number(req.body.currentSection);
        const priorIndex = doc.timerSection ?? 0;
        const priorSection = doc.paper.sections[priorIndex];
        const priorRemaining = doc.sectionRemainingTimes?.[priorSection.key];
        const priorDeadline = priorRemaining == null ? Infinity : new Date(doc.sectionStartedAt).getTime() + priorRemaining * 1000;
        // Allow one final expiry flush within the clock tick / network margin.
        // A late client cannot reopen an expired section after returning to the tab.
        const closingFlush = req.body.advanceSection === true && requestedSection === priorIndex && nowMs <= priorDeadline + 2000;
        const writable = requestedSection === timing.timerSection && !timing.sectionsExhausted ? timing.timerSection
          : closingFlush ? priorIndex : -1;
        const ids = new Set(doc.sectionsExhausted ? [] : doc.paper.sections[writable]?.questions.map(question => question.id));
        const merge = (saved, incoming) => ({
          ...Object.fromEntries(Object.entries(saved || {}).filter(([id]) => !ids.has(id))),
          ...Object.fromEntries(Object.entries(incoming).filter(([id]) => ids.has(id))),
        });
        if (hasAnswersPayload) answers = merge(doc.answers, answers);
        if (hasStatusesPayload) statuses = merge(doc.questionStatuses, statuses);
      }
    }

    const expectedRevision = req.body.baseRevision !== undefined
      ? Number(req.body.baseRevision)
      : (doc.revision ?? { $exists: false });
    const filter = {
      _id: doc._id,
      status: 'in_progress',
      ...(Number.isFinite(deadlineMs) ? { deadlineAt: { $gte: new Date(nowMs - graceMs) } } : {}),
      revision: expectedRevision,
      $or: [{ revision: { $lt: revision } }, { revision: { $exists: false } }],
    };

    const nextFields = {
      ...(hasAnswersPayload ? { answers } : {}),
      ...(hasStatusesPayload ? { questionStatuses: statuses } : {}),
      ...(timing || {}),
      ...(req.body.language === 'en' || req.body.language === 'bn' || req.body.language === 'hi' ? { language: req.body.language } : {}),
      ...(doc.paper?.sections?.[currentSection]?.questions?.[currentQuestion] ? { currentQuestionId: doc.paper.sections[currentSection].questions[currentQuestion].id } : {}),
      ...(hasSectionTimersPayload ? { sectionTimers: sanitizeSectionTimers(req.body.sectionTimers) } : {}),
      currentSection,
      currentQuestion,
      revision,
      updatedAt: new Date(),
    };
    // Tighten deadlineAt when a sectional paper advances early so hard expiry tracks actual remaining time.
    if (timing?.sectionRemainingTimes) {
      const remainingTotalSec = Object.values(timing.sectionRemainingTimes).reduce((sum, val) => sum + (Number.isFinite(val) ? Math.max(0, val) : 0), 0);
      nextFields.deadlineAt = new Date(nowMs + Math.ceil(remainingTotalSec * 1000));
    }

    const result = await updateAttemptProgress(filter, { $set: nextFields });

    if (!result.modifiedCount) {
      const latest = await getOwnedAttemptForAutosave(attemptId, req.user.id);
      if (!latest || latest.status !== 'in_progress') {
        return res.status(409).json({ error: 'Attempt is not in progress', code: 'ATTEMPT_NOT_IN_PROGRESS' });
      }
      const latestDeadlineMs = Date.parse(latest.deadlineAt);
      if ((Number.isFinite(latestDeadlineMs) && Date.now() > latestDeadlineMs + graceMs) || latest.sectionsExhausted) {
        return res.status(409).json({ error: 'Attempt time has expired', expired: true });
      }
      if (req.body.baseRevision !== undefined) {
        return res.status(409).json({ error: 'Progress changed in another tab. Reload this attempt before continuing.', code: 'REVISION_CONFLICT', revision: latest.revision });
      }
      // Monotonic non-baseRevision call superseded by an equal/higher revision: report current revision without silent loss.
      return res.json({ ok: true, revision: Math.max(Number(latest.revision) || 0, 0), ...(timing || {}), currentQuestion });
    }
    const effectiveDeadlineMs = nextFields.deadlineAt ? nextFields.deadlineAt.getTime() : deadlineMs;
    const timeLeft = Number.isFinite(effectiveDeadlineMs)
      ? Math.max(0, Math.floor((effectiveDeadlineMs - Date.now()) / 1000))
      : undefined;
    return res.json({ ok: true, revision, ...(timing || {}), ...(timeLeft !== undefined ? { timeLeft } : {}), serverNow: Date.now(), currentQuestion });
  } catch (err) {
    runtimeLog.error('Autosave error:', err);
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
    await invalidateTrainingDashboard(claimed.userId, claimed.examSlug);
    return res.json({ result: finalResult, attemptId: claimed.id });
  } catch (err) {
    runtimeLog.error('Submit error:', err);
    return res.status(500).json({ error: 'Failed to submit test' });
  }
};

export const getAttemptDetails = async (req, res) => {
  try {
    const doc = await getOwnedAttempt(req.params.attemptId, req.user.id);
    if (!doc) return res.status(404).json({ error: 'Attempt not found' });

    return res.json(presentAttempt(doc));
  } catch (err) {
    runtimeLog.error('Get attempt error:', err);
    return res.status(500).json({ error: 'Failed to get attempt' });
  }
};

export const getTestHistoryHandler = async (req, res) => {
  try {
    const { examSlug, testId } = req.params;
    const resources = await getTestHistory(req.user.id, examSlug, testId);
    return res.json({ attempts: resources });
  } catch (err) {
    runtimeLog.error('Test history error:', err);
    return res.status(500).json({ error: 'Failed to get history' });
  }
};

export const getExamHistoryHandler = async (req, res) => {
  try {
    const { examSlug } = req.params;
    const resources = await getExamHistory(req.user.id, examSlug);
    return res.json({ attempts: resources });
  } catch (err) {
    runtimeLog.error('Exam history error:', err);
    return res.status(500).json({ error: 'Failed to get history' });
  }
};
