import { storeQuestionImages } from "../middleware/questionImageStorage.js";
import express from "express";
import { idempotency } from '../middleware/idempotency.js';
import { fetchPublicTopicCountSnapshot } from "../services/questions/topicCountSnapshot.js";
import multer from 'multer';
import questionController from '../controllers/questionController.js';
import adminAuth from "../middleware/auth.js";
import { protect } from "../middleware/protect.js";
import { quizAnswerCommandSchema } from '@meow/contracts/progress';
import { submitQuizAnswer } from '../services/quizAnswerService.js';
import { fetchConceptGroupingStatus } from '../services/questions/conceptGroupService.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
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

// Bulk imports already fence each row by import key/hash and return large,
// per-row outcomes. Preserve that recovery protocol and its response budget.
router.post('/bulk', adminAuth, questionController.bulkCreateQuestions);
router.post('/bulk-delete', adminAuth, questionController.bulkDeleteQuestions);
router.post('/check-duplicates', adminAuth, questionController.checkDuplicates);
router.get('/topic-counts', async (req, res) => {
  try {
    const snapshot = await fetchPublicTopicCountSnapshot(req.query.subject);
    res.set('Cache-Control', 'no-cache');
    res.set('Vercel-CDN-Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    res.json(snapshot);
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});
router.get('/counts', questionController.getQuestionCounts);
router.get('/practice-test', questionController.generatePracticeTest);
router.post('/analyze', adminAuth, questionController.runAnalysis);
router.get("/image", questionController.getImageQuestions);
router.get('/session', questionController.getQuestionsSession);
router.get('/meta', questionController.getQuestionsMeta);
router.get('/concept-groups/:fingerprint', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.json(await fetchConceptGroupingStatus(req.params.fingerprint));
  } catch (error) {
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});
router.post('/answer', protect, async (req, res) => {
  const parsed = quizAnswerCommandSchema.safeParse(req.body);
  if (!parsed.success || req.get('Idempotency-Key') !== parsed.data.submissionId) {
    return res.status(400).json({ error: 'Valid quiz answer and matching Idempotency-Key required' });
  }
  try {
    const result = await submitQuizAnswer(req.user.id, parsed.data);
    if (result.replayed) res.set('Idempotency-Replayed', 'true');
    return res.json(result.response);
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message, ...(error.code ? { code: error.code } : {}) });
  }
});

// ── Generic routes ──────────────────────────────────────

router.post('/', adminAuth, questionUpload, storeQuestionImages, questionController.addQuestion);
router.get('/', questionController.getQuestions);

// ── Param routes LAST ───────────────────────────────────

router.post('/:id/answer', protect, idempotency('questions.answer'), questionController.submitAnswer);
router.get('/:id', questionController.getQuestionById);
router.put('/:id', adminAuth, questionController.updateQuestion);
router.patch('/:id', adminAuth, questionController.updateQuestion);
router.delete('/:id', adminAuth, questionController.deleteQuestion);

// ── Error handler ───────────────────────────────────────

router.use((err, _req, res, _next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }
  return res.status(500).json({ error: 'Upload failed' });
});

export default router;
