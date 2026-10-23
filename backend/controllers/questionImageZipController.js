import multer from 'multer';
import { ZIP_LIMITS } from '../services/uploads/safeZip.js';
import { parseQuestionExamMode } from '../services/questions/questionExamMode.js';
import * as questionImageZipService from '../services/questions/questionImageZip.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: ZIP_LIMITS.compressedBytes, // 20 MiB
    files: 1,
    fields: 5,
    fieldSize: 1024 * 1024, // 1 MiB (supports up to 500 question timestamps)
  },
}).single('zipFile');

let processing = false;

/**
 * Middleware to parse multipart ZIP uploads with size and mutex validation.
 */
export const uploadZip = (req, res, next) => {
  if (processing) {
    return res.status(503).json({
      error: 'Another Question Bank image ZIP is processing. Wait for it to finish, then retry.',
    });
  }
  if (req.file) return next();
  upload(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'ZIP exceeds 20 MiB. Split it into smaller uploads.',
        });
      }
      return res.status(400).json({
        error: err.message || 'Send one ZIP as zipFile, with expectedUpdatedAts and action fields.',
      });
    }
    next();
  });
};

/**
 * Express handler for Question Bank image ZIP imports.
 * Enforces single-flight process mutex, validates multipart payload,
 * normalizes parameters, and executes validation or atomic application.
 */
export async function handleQuestionBankImageZip(req, res) {
  // 1. In-process single-flight mutex: reject immediately
  if (processing) {
    return res.status(503).json({
      error: 'Another Question Bank image ZIP is processing. Wait for it to finish, then retry.',
    });
  }
  processing = true;

  try {
    // 2. Multer multipart parsing (conditional for mock test requests)
    if (!req.file) {
      const multerError = await new Promise(resolve => upload(req, res, resolve));
      if (multerError) {
        if (multerError.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            error: 'ZIP exceeds 20 MiB. Split it into smaller uploads.',
          });
        }
        return res.status(400).json({
          error: multerError.message || 'Send one ZIP as zipFile, with expectedUpdatedAts and action fields.',
        });
      }
    }

    // 3. File existence and extension validation
    if (!req.file || !req.file.buffer || !/\.zip$/i.test(req.file.originalname || '')) {
      return res.status(400).json({
        error: 'Choose one .zip file containing manifest.json and images/.',
      });
    }

    // 4. Action parameter handling ('validate' default | 'apply')
    const rawAction = req.body?.action;
    const action = rawAction ? String(rawAction).trim().toLowerCase() : 'validate';
    if (!['validate', 'apply'].includes(action)) {
      return res.status(400).json({
        error: 'action must be validate or apply.',
      });
    }

    // 5. Concurrency timestamps parsing (expectedUpdatedAts)
    let expectedUpdatedAts = {};
    const rawUpdatedAts = req.body?.expectedUpdatedAts;
    if (rawUpdatedAts) {
      if (typeof rawUpdatedAts === 'string') {
        try {
          expectedUpdatedAts = JSON.parse(rawUpdatedAts);
        } catch {
          return res.status(400).json({
            error: 'Missing question versions. Reload questions and try again.',
          });
        }
      } else if (typeof rawUpdatedAts === 'object' && rawUpdatedAts !== null && !Array.isArray(rawUpdatedAts)) {
        expectedUpdatedAts = rawUpdatedAts;
      } else {
        return res.status(400).json({
          error: 'Invalid question versions format. Reload questions and try again.',
        });
      }
    } else if (action === 'apply') {
      return res.status(400).json({
        error: 'Missing question versions. Reload questions and try again.',
      });
    }

    // 6. Exam mode extraction & validation
    const rawMode = req.headers?.['x-exam-mode'] || req.query?.examMode || req.body?.examMode || req.user?.examMode || 'ssc';
    let examMode;
    try {
      examMode = parseQuestionExamMode(rawMode) || 'ssc';
    } catch {
      return res.status(400).json({
        error: 'Invalid exam mode. Choose SSC or IIT JAM.',
      });
    }

    // 7. Invoke pipeline core via module namespace (supports Vitest spies)
    const importFn =
      questionImageZipService.importQuestionBankImageZip ||
      questionImageZipService.processQuestionBankImageZip;

    const outcome = await importFn(req.file.buffer, {
      action,
      examMode,
      expectedUpdatedAts,
      validateOnly: action === 'validate',
    });

    if (action === 'apply') {
      const qCount = outcome.questionCount || 0;
      const aCount = outcome.appliedCount || 0;
      return res.json({
        success: true,
        appliedCount: aCount,
        questionCount: qCount,
        message: outcome.message || `Successfully updated ${qCount} question${qCount === 1 ? '' : 's'} with ${aCount} image${aCount === 1 ? '' : 's'}.`,
        ...outcome,
      });
    }

    return res.json(outcome);
  } catch (error) {
    const status = error.statusCode || error.status || 500;
    const message = error.statusCode || error.status
      ? error.message
      : (error.message || 'Could not import Question Bank image ZIP. Reload questions to check state before retrying.');
    return res.status(status).json({ error: message });
  } finally {
    // 8. Guaranteed mutex release
    processing = false;
  }
}

export const handleQuestionImageZip = handleQuestionBankImageZip;
export const adminQuestionImageZip = handleQuestionBankImageZip;
export default handleQuestionBankImageZip;
