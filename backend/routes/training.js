import express from 'express';
import { idempotency } from '../middleware/idempotency.js';
import { protect } from '../middleware/protect.js';
import { aiLimiter, trainingLimiter } from '../middleware/rateLimiter.js';
import { getTrainingCapabilities, getTrainingDashboard, startTrainingSession, getTrainingSession, applyTrainingAction, diagnoseTrainingSession, updateTrainingMistake } from '../controllers/trainingController.js';

const router = express.Router();
router.use(protect, trainingLimiter);
router.get("/capabilities", getTrainingCapabilities);
router.get("/dashboard", getTrainingDashboard);
router.post("/sessions", idempotency('training.create'), startTrainingSession);
router.get("/sessions/:id", getTrainingSession);
router.post("/sessions/:id/actions", idempotency('training.action'), applyTrainingAction);
router.post("/sessions/:id/diagnosis", aiLimiter, idempotency('training.diagnosis'), diagnoseTrainingSession);
router.patch("/sessions/:id/mistakes", updateTrainingMistake);
export default router;
