import express from 'express';
import { protect } from '../middleware/protect.js';
import { getTrainingDashboard, startTrainingSession, getTrainingSession, applyTrainingAction, diagnoseTrainingSession, updateTrainingMistake } from '../controllers/trainingController.js';

const router = express.Router();
router.use(protect);
router.get("/dashboard", getTrainingDashboard);
router.post("/sessions", startTrainingSession);
router.get("/sessions/:id", getTrainingSession);
router.post("/sessions/:id/actions", applyTrainingAction);
router.post("/sessions/:id/diagnosis", diagnoseTrainingSession);
router.patch("/sessions/:id/mistakes", updateTrainingMistake);
export default router;
