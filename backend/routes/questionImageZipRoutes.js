import express from 'express';
import adminAuth from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import { handleQuestionBankImageZip, uploadZip } from '../controllers/questionImageZipController.js';

const router = express.Router();

/**
 * POST /api/questions/admin/image-zip
 * POST /api/questions/image-zip
 *
 * Unified Question Bank image ZIP import pipeline.
 * Handles question, solution, and option images (English & Bengali).
 */
router.post(
  ['/image-zip', '/admin/image-zip'],
  uploadLimiter,
  adminAuth,
  uploadZip,
  handleQuestionBankImageZip
);

export default router;
