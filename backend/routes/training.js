import express from 'express';
import { protect } from '../middleware/protect.js';
import { aiLimiter, trainingLimiter } from '../middleware/rateLimiter.js';
import { getTrainingCapabilities, getTrainingDashboard, startTrainingSession, getTrainingSession, applyTrainingAction, diagnoseTrainingSession, updateTrainingMistake } from '../controllers/trainingController.js';

const router = express.Router();
router.use(protect, trainingLimiter);
router.get("/capabilities", getTrainingCapabilities);
router.get("/dashboard", getTrainingDashboard);
router.post("/sessions", startTrainingSession);
router.get("/sessions/:id", getTrainingSession);
router.post("/sessions/:id/actions", applyTrainingAction);
router.post("/sessions/:id/diagnosis", aiLimiter, diagnoseTrainingSession);
router.patch("/sessions/:id/mistakes", updateTrainingMistake);
export default router;
