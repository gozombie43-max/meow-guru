import { runtimeLog } from '../infrastructure/runtimeLog.js';
import { SYSTEM_PROMPT as diagramPrompt } from "@meow/contracts/diagramPrompt";
import { generateQuestionDrafts, classifyQuestion, generateDiagram } from "../ai/gateway.js";
import { tutorChat } from '../services/tutorChatService.js';
import { enqueueTutorJob, getTutorJob, cancelTutorJob } from '../services/tutorJobs.js';
// backend/routes/aiRoutes.js
import express from "express";
import { idempotency } from '../middleware/idempotency.js';
import multer from "multer";
import { chatComplete } from "../ai/azureClient.js";
import adminAuth from "../middleware/auth.js";
import { protect } from "../middleware/protect.js";
import { aiLimiter } from '../middleware/rateLimiter.js';
import { aiAdmission, acquireAiLease, releaseAiLease } from '../middleware/aiAdmission.js';
import { tutorRequestSchema, tutorReplySchema, tutorJobResponseSchema } from '@meow/contracts/tutor';
import { validateTutorAttachment, MAX_TUTOR_ATTACHMENT_BYTES } from '../services/uploads/tutorAttachment.js';
import * as tutorQuotaRepo from '../repositories/tutorQuotaRepository.js';
import { imageBudget } from '../infrastructure/dependencyBoundary.js';

const reserveTutorUsage = (...args) => tutorQuotaRepo.reserveTutorUsage(...args);
const releaseTutorUsage = (...args) =>
  'releaseTutorUsage' in tutorQuotaRepo && typeof tutorQuotaRepo.releaseTutorUsage === 'function'
    ? Promise.resolve(tutorQuotaRepo.releaseTutorUsage(...args))
    : Promise.resolve(false);

const router = express.Router();
const ALLOWED_GENERATION_DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'mixed']);

// Establish the authenticated identity before generation quotas and admission.
router.use(protect);
// Polling and cancellation are inexpensive and do not consume generation quota.
router.use((req, res, next) => req.method === 'POST' ? aiLimiter(req, res, next) : next());
router.post('/quota', async (req, res) => {
  const lease = await acquireAiLease(req.user.id);
  res.json({ ok: true, leaseId: lease.leaseId });
});
router.delete('/quota/:leaseId', async (req, res) => {
  await releaseAiLease(req.user.id, req.params.leaseId);
  res.json({ ok: true });
});
router.use((req, res, next) => req.method === 'POST' ? aiAdmission(req, res, next) : next());

const tutorUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TUTOR_ATTACHMENT_BYTES, files: 1, fields: 4, parts: 5, fieldSize: 200000 },
});

function parseMaybeJSON(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function wakeTutorAttachmentWorker() {
  if (process.env.QUIZ_ONLY_MODE !== 'true' || process.env.RUN_EMBEDDED_WORKERS !== 'true') return;

  void import('../infrastructure/attachmentWorker.js')
    .then(({ startAttachmentWorker }) => startAttachmentWorker({
      stopWhenIdle: true,
      idleTimeoutMs: 10_000,
    }))
    .catch((error) => {
      runtimeLog.error('Failed to start on-demand tutor attachment worker:', error);
    });
}

router.post('/diagram', async (req, res, next) => {
  const userId = String(req.user?.id || req.user?._id);
  const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
  if (!question) return res.status(400).json({ error: 'Question text is required' });
  if (question.length > 4000) return res.status(413).json({ error: 'Question text is too long' });

  let reservation;
  try {
    reservation = await reserveTutorUsage(userId, { question });
  } catch (error) {
    const statusCode = error?.statusCode || 502;
    return res.status(statusCode).json({
      success: false,
      error: statusCode === 429 ? error.message : 'AI request failed. Please retry shortly.',
    });
  }

  try {
    return res.json(await generateDiagram(question, diagramPrompt));
  } catch (error) {
    await releaseTutorUsage(reservation, { userId, input: { question } }).catch(() => {});
    return next(error);
  }
});

// ── 1. Generate Questions ─────────────────────────────
router.post("/generate-questions", adminAuth, idempotency('ai.question.generate'), async (req, res) => {
  const { topic, difficulty = "medium", count = 5 } = req.body || {};

  if (!topic || typeof topic !== "string" || !topic.trim()) {
    return res.status(400).json({ error: "topic is required" });
  }
  const normalizedTopic = topic.trim();
  if (normalizedTopic.length > 200) {
    return res.status(400).json({ error: "topic must be at most 200 characters" });
  }

  const normalizedDifficulty = typeof difficulty === "string"
    ? difficulty.trim().toLowerCase()
    : "";
  if (!ALLOWED_GENERATION_DIFFICULTIES.has(normalizedDifficulty)) {
    return res.status(400).json({ error: "difficulty must be easy, medium, hard, or mixed" });
  }

  const parsedCount = Number(count);
  if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 20) {
    return res.status(400).json({ error: "count must be an integer between 1 and 20" });
  }

  const systemPrompt = `You are an expert SSC CGL and CAT exam question creator.
Always respond with valid JSON only. No markdown, no explanation.`;

  const userPrompt = `Generate ${parsedCount} MCQ questions on topic: "${normalizedTopic}", difficulty: "${normalizedDifficulty}".
Return a JSON array like this:
[
  {
    "question": "question text here",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correctAnswer": 0,
    "explanation": "why this answer is correct",
    "topic": "${normalizedTopic}",
    "difficulty": "${normalizedDifficulty}"
  }
]`;

  try {
    const questions = await generateQuestionDrafts(userPrompt, systemPrompt);
    res.json({ success: true, questions });
  } catch (err) {
    res.status(err.statusCode || 502).json({ success: false, error: 'AI request failed. Please retry shortly.' });
  }
});

// ── 2. Generate Explanation for a Question ────────────
router.post("/explain", async (req, res) => {
  const userId = String(req.user?.id || req.user?._id);

  const rawQuestion = req.body?.question;
  if (!rawQuestion || typeof rawQuestion !== "string" || !rawQuestion.trim()) {
    return res.status(400).json({ error: "question is required" });
  }

  const question = rawQuestion.trim();
  if (question.length > 4000) {
    return res.status(413).json({ error: "Question text is too long" });
  }

  const rawOptions = req.body?.options;
  let options = [];
  if (rawOptions !== undefined && rawOptions !== null) {
    if (!Array.isArray(rawOptions)) {
      return res.status(400).json({ error: "options must be an array of strings" });
    }
    if (rawOptions.length > 10) {
      return res.status(400).json({ error: "Too many options provided (maximum 10)" });
    }
    for (const opt of rawOptions) {
      if (typeof opt !== "string" || opt.length > 1000) {
        return res.status(400).json({ error: "Each option must be a string up to 1000 characters" });
      }
    }
    options = rawOptions;
  }

  const correctAnswer = req.body?.correctAnswer;
  let answerText = "";
  if (typeof correctAnswer === "number" && Number.isInteger(correctAnswer) && correctAnswer >= 0 && correctAnswer < options.length) {
    answerText = options[correctAnswer];
  } else if (typeof correctAnswer === "string") {
    answerText = correctAnswer.slice(0, 1000);
  }

  const userPrompt = `Explain the solution to this SSC/CAT exam question in simple steps.
Question: ${question}
Options: ${options.join(", ")}
Correct Answer: ${answerText}

Give a clear step-by-step explanation. Keep it concise.`;

  let reservation;
  try {
    reservation = await reserveTutorUsage(userId, { question, options, correctAnswer });
  } catch (err) {
    const statusCode = err?.statusCode || 502;
    runtimeLog.error('explain error:', err?.message || err);
    return res.status(statusCode).json({
      success: false,
      error: statusCode === 429 ? err?.message : 'AI request failed. Please retry shortly.',
    });
  }

  try {
    const explanation = await chatComplete(userPrompt, "o4-mini");
    res.json({ success: true, explanation });
  } catch (err) {
    await releaseTutorUsage(reservation, { userId, input: { question, options, correctAnswer } }).catch(() => {});
    const statusCode = err?.statusCode || 502;
    runtimeLog.error('explain error:', err?.message || err);
    res.status(statusCode).json({
      success: false,
      error: statusCode === 429 ? err?.message : 'AI request failed. Please retry shortly.',
    });
  }
});

// ── 2b. Tutor chat for submitted quiz questions ───────
router.post('/tutor-chat', (req, res, next) => {
  tutorUpload.single('attachment')(req, res, error => {
    if (!error) return next();
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: 'Provide one JPG, PNG, WebP image or PDF, up to 8 MB.' });
  });
}, async (req, res) => {
  const userId = String(req.user.id);
  const parsed = tutorRequestSchema.safeParse({
    context: req.body.context,
    message: req.body.message,
    history: parseMaybeJSON(req.body.history, []),
    lang: req.body.lang || 'en',
  });
  if (!parsed.success) return res.status(400).json({ error: 'Invalid tutor request' });
  const input = parsed.data;
  if (!input.context || (!input.message && !req.file)) return res.status(400).json({ error: 'context and message or attachment are required' });
  if (JSON.stringify(input).length > 200000) return res.status(413).json({ error: 'Chat context is too large' });
  if (req.file) {
    try {
      const attachment = await imageBudget.execute(() => validateTutorAttachment(req.file));
      const job = await enqueueTutorJob(userId, input, attachment, req.get('Idempotency-Key'));
      wakeTutorAttachmentWorker();
      return res.status(202).json(tutorJobResponseSchema.parse({ success: true, jobId: job._id, status: job.status }));
    } catch (err) {
      runtimeLog.error('tutor-chat attachment error:', err?.message || err);
      const statusCode = err?.statusCode || 502;
      return res.status(statusCode).json({
        success: false,
        error: statusCode < 500 ? err.message : 'AI request failed. Please retry shortly.',
      });
    }
  }
  let reservation;
  try {
    reservation = await reserveTutorUsage(userId, input);
  } catch (err) {
    runtimeLog.error('tutor-chat error:', err?.message || err);
    return res.status(err.statusCode || 502).json({
      success: false,
      error: err.statusCode === 429 ? err.message : 'AI request failed. Please retry shortly.',
    });
  }
  try {
    res.json(tutorReplySchema.parse(await tutorChat(input)));
  } catch (err) {
    await releaseTutorUsage(reservation, { userId, input }).catch(() => {});
    runtimeLog.error('tutor-chat error:', err?.message || err);
    res.status(err.statusCode || 502).json({
      success: false,
      error: err.statusCode === 429 ? err.message : 'AI request failed. Please retry shortly.',
    });
  }
});
router.get('/tutor-jobs/:id', async (req, res) => {
  const userId = String(req.user.id);
  const job = await getTutorJob(userId, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'queued' || job.status === 'running') wakeTutorAttachmentWorker();
  res.json(tutorJobResponseSchema.parse({ jobId: job._id, status: job.status, ...(job.status === 'completed' ? job.result : {}), ...(job.status === 'failed' ? { error: 'Attachment processing failed. Please retry.' } : {}) }));
});
router.delete('/tutor-jobs/:id', async (req, res) => {
  const userId = String(req.user.id);
  const cancelled = await cancelTutorJob(userId, req.params.id);
  res.status(cancelled ? 200 : 404).json({ cancelled });
});

// ── 3. Tag a Question ─────────────────────────────────
router.post("/tag-question", adminAuth, async (req, res) => {
  const { question } = req.body || {};

  if (!question || typeof question !== "string" || !question.trim()) {
    return res.status(400).json({ error: "question is required" });
  }
  const normalizedQuestion = question.trim();
  if (normalizedQuestion.length > 4000) {
    return res.status(413).json({ error: "Question text is too long" });
  }

  const systemPrompt = `You are an expert SSC CGL exam analyst. Return JSON only.`;

  const userPrompt = `Analyze this SSC exam question and return tags.
Question: ${normalizedQuestion}
Return JSON:
{
  "subject": "",
  "chapter": "",
  "concept": "",
  "difficulty": "easy|medium|hard",
  "trap_type": "",
  "formula": ""
}`;

  try {
    const tags = await classifyQuestion(userPrompt, systemPrompt);
    res.json({ success: true, tags });
  } catch (err) {
    res.status(err.statusCode || 502).json({ success: false, error: 'AI request failed. Please retry shortly.' });
  }
});

export default router;
