import express from 'express';
import { z } from 'zod';
import { idempotency } from '../middleware/idempotency.js';
import { protect } from '../middleware/protect.js';
import { aiAdmission } from '../middleware/aiAdmission.js';
import { aiLimiter, trainingLimiter } from '../middleware/rateLimiter.js';
import { validateParams } from '../middleware/validation.js';
import { getTrainingCapabilities, getTrainingDashboard, startTrainingSession, getTrainingSession, applyTrainingAction, diagnoseTrainingSession, updateTrainingMistake } from '../controllers/trainingController.js';

const trainingSessionIdParamsSchema = z.object({
  id: z.string().trim().min(1).max(128).regex(/^[a-zA-Z0-9._-]+$/, 'Invalid training session id'),
});

const trainingDashboardQuerySchema = z.object({
  exam: z.string().trim().max(64).optional(),
});

const trainingActionsQuerySchema = z.object({
  response: z.enum(['full', 'delta']).optional(),
});

function validateQuerySafe(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Query validation failed',
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    Object.defineProperty(req, 'query', {
      value: parsed.data,
      writable: true,
      enumerable: true,
      configurable: true,
    });
    return next();
  };
}

const router = express.Router();
router.use(protect, trainingLimiter);
router.get("/capabilities", getTrainingCapabilities);
router.get("/dashboard", validateQuerySafe(trainingDashboardQuerySchema), getTrainingDashboard);
router.post("/sessions", idempotency('training.create'), startTrainingSession);
router.get("/sessions/:id", validateParams(trainingSessionIdParamsSchema), getTrainingSession);
router.post("/sessions/:id/actions", validateParams(trainingSessionIdParamsSchema), validateQuerySafe(trainingActionsQuerySchema), idempotency('training.action'), applyTrainingAction);
router.post("/sessions/:id/diagnosis", validateParams(trainingSessionIdParamsSchema), aiLimiter, aiAdmission, idempotency('training.diagnosis'), diagnoseTrainingSession);
router.patch("/sessions/:id/mistakes", validateParams(trainingSessionIdParamsSchema), updateTrainingMistake);
export default router;
