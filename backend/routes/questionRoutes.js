import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import questionController from '../controllers/questionController.js';
import { getQuestionsContainer } from '../containerStore.js';

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

// Bulk insert — POST /api/questions/bulk
router.post('/bulk', async (req, res) => {
  try {
    const container = getQuestionsContainer();
    if (!container) return res.status(503).json({ error: 'DB not ready' });

    const questions = req.body; // array of question objects
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Body must be a non-empty array' });
    }

    const results = await Promise.allSettled(
      questions.map((q) => container.items.create(q))
    );

    const inserted = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    return res.json({ inserted, failed, total: questions.length });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', questionUpload, questionController.addQuestion);
router.get('/', questionController.getQuestions);
router.get('/:id', questionController.getQuestionById);
router.put('/:id', questionController.updateQuestion);
router.delete('/:id', questionController.deleteQuestion);
router.get('/practice-test', questionController.generatePracticeTest);
router.post('/analyze', questionController.runAnalysis);

router.use((err, _req, res, _next) => {
  if (err) {
    return res.status(400).json({ error: err.message || 'Upload failed' });
  }
  return res.status(500).json({ error: 'Upload failed' });
});

export default router;