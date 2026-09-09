import { tutorChat } from '../services/tutorChatService.js';
import { enqueueTutorJob, getTutorJob, cancelTutorJob } from '../services/tutorJobs.js';
// backend/routes/aiRoutes.js
import express from "express";
import multer from "multer";
import { chatComplete, chatJSON } from "../ai/azureClient.js";
import adminAuth from "../middleware/auth.js";
import { protect } from "../middleware/protect.js";

const router = express.Router();

const tutorUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 18 * 1024 * 1024, files: 1, fields: 4, parts: 5, fieldSize: 200000 },
  fileFilter: (_req, file, cb) => {
    const allowed =
      file.mimetype.startsWith("image/") || file.mimetype === "application/pdf";
    if (allowed) return cb(null, true);
    return cb(new Error("Only image files and PDFs are allowed"));
  },
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
  if (process.env.QUIZ_ONLY_MODE !== 'true') return;

  void import('../infrastructure/attachmentWorker.js')
    .then(({ startAttachmentWorker }) => startAttachmentWorker({
      stopWhenIdle: true,
      idleTimeoutMs: 10_000,
    }))
    .catch((error) => {
      console.error('Failed to start on-demand tutor attachment worker:', error);
    });
}

// ── 1. Generate Questions ─────────────────────────────
router.post("/generate-questions", adminAuth, async (req, res) => {
  const { topic, difficulty = "medium", count = 5 } = req.body;

  if (!topic) return res.status(400).json({ error: "topic is required" });

  const systemPrompt = `You are an expert SSC CGL and CAT exam question creator.
Always respond with valid JSON only. No markdown, no explanation.`;

  const userPrompt = `Generate ${count} MCQ questions on topic: "${topic}", difficulty: "${difficulty}".
Return a JSON array like this:
[
  {
    "question": "question text here",
    "options": ["A) option1", "B) option2", "C) option3", "D) option4"],
    "correctAnswer": 0,
    "explanation": "why this answer is correct",
    "topic": "${topic}",
    "difficulty": "${difficulty}"
  }
]`;

  try {
    const questions = await chatJSON(userPrompt, "o4-mini", systemPrompt);
    res.json({ success: true, questions });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2. Generate Explanation for a Question ────────────
router.post("/explain", protect, async (req, res) => {
  const { question, correctAnswer, options } = req.body;

  if (!question) return res.status(400).json({ error: "question is required" });

  const userPrompt = `Explain the solution to this SSC/CAT exam question in simple steps.
Question: ${question}
Options: ${options?.join(", ")}
Correct Answer: ${options?.[correctAnswer]}

Give a clear step-by-step explanation. Keep it concise.`;

  try {
    const explanation = await chatComplete(userPrompt, "o4-mini");
    res.json({ success: true, explanation });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── 2b. Tutor chat for submitted quiz questions ───────
router.post('/tutor-chat', protect, tutorUpload.single('attachment'), async (req, res) => {
  const input = { context: req.body.context, message: req.body.message, history: parseMaybeJSON(req.body.history, []) };
  if (!input.context || (!input.message && !req.file)) return res.status(400).json({ error: 'context and message or attachment are required' });
  if (JSON.stringify(input).length > 200000) return res.status(413).json({ error: 'Chat context is too large' });
  if (req.file) {
    const job = await enqueueTutorJob(String(req.user.id), input, req.file, req.get('Idempotency-Key'));
    wakeTutorAttachmentWorker();
    return res.status(202).json({ success: true, jobId: job._id, status: job.status });
  }
  res.json(await tutorChat(input));
});
router.get('/tutor-jobs/:id', protect, async (req, res) => {
  const job = await getTutorJob(String(req.user.id), req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'queued' || job.status === 'running') wakeTutorAttachmentWorker();
  res.json({ jobId: job._id, status: job.status, ...(job.status === 'completed' ? job.result : {}), ...(job.status === 'failed' ? { error: job.error } : {}) });
});
router.delete('/tutor-jobs/:id', protect, async (req, res) => {
  const cancelled = await cancelTutorJob(String(req.user.id), req.params.id);
  res.status(cancelled ? 200 : 404).json({ cancelled });
});

// ── 3. Tag a Question ─────────────────────────────────
router.post("/tag-question", adminAuth, async (req, res) => {
  const { question } = req.body;

  if (!question) return res.status(400).json({ error: "question is required" });

  const systemPrompt = `You are an expert SSC CGL exam analyst. Return JSON only.`;

  const userPrompt = `Analyze this SSC exam question and return tags.
Question: ${question}
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
    const tags = await chatJSON(userPrompt, "o4-mini", systemPrompt);
    res.json({ success: true, tags });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
