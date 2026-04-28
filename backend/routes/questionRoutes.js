import express from "express";
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import questionController from '../controllers/questionController.js';
import { getQuestionsContainer } from "../containerStore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 8 ? ext : '';
    const id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
    cb(null, `${Date.now()}-${id}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed'));
    }
    return cb(null, true);
  },
});

const questionUpload = upload.fields([
  { name: 'questionImage', maxCount: 1 },
  { name: 'optionAImage', maxCount: 1 },
  { name: 'optionBImage', maxCount: 1 },
  { name: 'optionCImage', maxCount: 1 },
  { name: 'optionDImage', maxCount: 1 },
  { name: 'solutionImage', maxCount: 1 },
]);

// ── Specific named routes FIRST (before /:id) ──────────

// Bulk insert — POST /api/questions/bulk
router.post('/bulk', async (req, res) => {
  try {
    const container = getQuestionsContainer();
    if (!container) return res.status(503).json({ error: 'DB not ready' });

    const questions = req.body;
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Body must be a non-empty array' });
    }

    const normalizedQuestions = questions.map((q, idx) => {
      const item = (q && typeof q === 'object') ? { ...q } : { value: q };

      if (item.id !== undefined && item.id !== null) {
        item.id = String(item.id).trim();
      }

      if (!item.id) {
        const suffix = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
        item.id = `q_${Date.now()}_${idx}_${suffix}`;
      }

      const quizSubject = String(item.quizSubject ?? '').trim();
      const quizTopic = String(item.quizTopic ?? '').trim();

      if (!item.subject && quizSubject) item.subject = quizSubject;
      if (!item.chapter && quizTopic) item.chapter = quizTopic;

      if (quizTopic) {
        item.topic = quizTopic;
      }

      if (!item.topic) {
        item.topic = item.chapter || item.subject || item.category || 'misc';
      }

      item.topic = String(item.topic).trim() || 'misc';

      return item;
    });

    const buildNewId = (idx, attempt = 0) => {
      const suffix = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(8).toString('hex');
      return `q_${Date.now()}_${idx}_${attempt}_${suffix}`;
    };

    const createWithRetry = async (item, idx) => {
      let current = { ...item };
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          return await container.items.create(current);
        } catch (err) {
          const status = err?.code || err?.statusCode;
          if (status !== 409) throw err;
          current = { ...current, id: buildNewId(idx, attempt + 1) };
        }
      }
      return await container.items.create({ ...current, id: buildNewId(idx, 99) });
    };

    const results = await Promise.allSettled(
      normalizedQuestions.map((q, idx) => createWithRetry(q, idx))
    );

    const inserted = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return res.json({ inserted, failed, total: questions.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/practice-test', questionController.generatePracticeTest);
router.post('/analyze', questionController.runAnalysis);

router.post('/check-duplicates', async (req, res) => {
  try {
    let container;
    try {
      container = getQuestionsContainer();
    } catch (err) {
      return res.status(503).json({ error: 'Database not ready' });
    }

    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'questions must be a non-empty array' });
    }

    const ids = questions
      .map((q) => String(q.id || q._id || q.questionId || ''))
      .filter(Boolean);

    const getQuestionText = (q) => String(q?.question ?? q?.questionText ?? q?.q ?? '').trim();
    const incomingTexts = questions
      .map((q) => getQuestionText(q))
      .filter(Boolean);
    const uniqueTexts = Array.from(new Set(incomingTexts));

    if (ids.length === 0 && uniqueTexts.length === 0) {
      return res.json({ results: [] });
    }

    const batchSize = 100;
    const existingMap = new Map();

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const paramList = batch.map((_, idx) => `@id${i + idx}`).join(', ');
      const parameters = batch.map((id, idx) => ({
        name: `@id${i + idx}`,
        value: id,
      }));

      const { resources } = await container.items
        .query({
          query: `SELECT c.id, c.question, c.questionText FROM c WHERE c.id IN (${paramList})`,
          parameters,
        })
        .fetchAll();

      resources.forEach((r) => {
        existingMap.set(r.id, r.question || r.questionText || '');
      });
    }

    const textBatchSize = 50;
    const existingTextMap = new Map();

    for (let i = 0; i < uniqueTexts.length; i += textBatchSize) {
      const batch = uniqueTexts.slice(i, i + textBatchSize);
      const paramList = batch.map((_, idx) => `@text${i + idx}`).join(', ');
      const parameters = batch.map((text, idx) => ({
        name: `@text${i + idx}`,
        value: text,
      }));

      const { resources } = await container.items
        .query({
          query: `SELECT c.id, c.question, c.questionText FROM c WHERE (IS_DEFINED(c.question) AND c.question IN (${paramList})) OR (IS_DEFINED(c.questionText) AND c.questionText IN (${paramList}))`,
          parameters,
        })
        .fetchAll();

      resources.forEach((r) => {
        const text = String(r.question || r.questionText || '').trim();
        if (text && !existingTextMap.has(text)) {
          existingTextMap.set(text, { id: r.id, text });
        }
      });
    }

    const results = questions.map((q) => {
      const id = String(q.id || q._id || q.questionId || '');
      const incomingText = getQuestionText(q);
      const textKey = incomingText;

      if (id && existingMap.has(id)) {
        const existingText = String(existingMap.get(id) || '').trim();

        if (incomingText && incomingText === existingText) {
          return { id, status: 'exact-duplicate', textKey };
        }

        return {
          id,
          status: 'id-conflict',
          existingText: existingText.substring(0, 100),
          incomingText: incomingText.substring(0, 100),
          textKey,
        };
      }

      if (incomingText && existingTextMap.has(incomingText)) {
        const matched = existingTextMap.get(incomingText);
        return {
          id,
          status: 'text-duplicate',
          existingId: matched?.id,
          existingText: matched?.text?.substring(0, 100) || '',
          incomingText: incomingText.substring(0, 100),
          textKey,
        };
      }

      return { id, status: 'new', textKey };
    });

    return res.json({ results });
  } catch (err) {
    console.error('[check-duplicates]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

router.get("/image", async (req, res) => {
  try {
    const questionsContainer = getQuestionsContainer();
    const { topic = "visual_reasoning", limit = 20 } = req.query;

    const query = {
      query: `
        SELECT * FROM c
        WHERE c.questionType = "image_mcq"
        AND c.topic = @topic
        OFFSET 0 LIMIT @limit
      `,
      parameters: [
        { name: "@topic", value: topic },
        { name: "@limit", value: parseInt(limit) },
      ],
    };

    const { resources } = await questionsContainer.items
      .query(query)
      .fetchAll();

    res.json({
      count: resources.length,
      questions: resources,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Generic routes ──────────────────────────────────────

router.post('/', questionUpload, questionController.addQuestion);
router.get('/', questionController.getQuestions);

// ── Param routes LAST ───────────────────────────────────

router.get('/:id', questionController.getQuestionById);
router.put('/:id', questionController.updateQuestion);
router.delete('/:id', questionController.deleteQuestion);

// ── Error handler ───────────────────────────────────────

router.use((err, _req, res, _next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }
  return res.status(500).json({ error: 'Upload failed' });
});

export default router;