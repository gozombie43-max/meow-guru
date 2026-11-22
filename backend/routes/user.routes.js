// backend/routes/user.routes.js
import express from 'express';
import { z } from 'zod';
import { protect } from '../middleware/protect.js';
import { idempotency } from '../middleware/idempotency.js';
import { validateBody } from '../middleware/validation.js';
import {
  bookmarkPatchSchema,
  profilePatchSchema,
  progressPatchSchema,
  recentQuizPatchSchema,
  studyTimePatchSchema,
} from '../schemas/apiSchemas.js';
import {
  getMe,
  getRecentQuiz,
  getAiChat,
  appendAiMessages,
  updateProfile,
  updateBookmarks,
  updateProgress,
  updateRecentQuizzes,
  updateUsage,
  getAiChats,
  updateAiChat,
  deleteAiChat,
  getNotificationPreferences,
  updateNotificationPreferences,
  getDailyPracticeReminder,
  updateDailyPracticeReminder,
  getStudyGoal,
  updateStudyGoal,
} from '../controllers/userController.js';

const router = express.Router();

const aiChatUpdateSchema = z.object({
  title: z.string().trim().max(80).optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'bot']),
        content: z.string().max(12000),
      }),
    )
    .min(1)
    .max(80),
});

export const initUserRoutes = () => router;

// ── GET /users/me ───────────────────────────────────────
router.get('/me', protect, getMe);

// ── PATCH /users/me/profile ─────────────────────────────
router.patch('/me/profile', protect, validateBody(profilePatchSchema), updateProfile);

// ── PATCH /users/me/bookmarks ───────────────────────────
router.patch('/me/bookmarks', protect, validateBody(bookmarkPatchSchema), updateBookmarks);

// ── PATCH /users/me/progress ────────────────────────────
router.patch('/me/progress', protect, validateBody(progressPatchSchema), idempotency('users.progress'), updateProgress);

// ── PATCH /users/me/recent-quizzes ─────────────────────
router.get('/me/recent-quizzes/:quizKey', protect, getRecentQuiz);
router.patch('/me/recent-quizzes', protect, validateBody(recentQuizPatchSchema), updateRecentQuizzes);

// ── PATCH /users/me/usage ──────────────────────────────
router.patch('/me/usage', protect, validateBody(studyTimePatchSchema), idempotency('users.usage'), updateUsage);

// ── GET /users/me/ai-chats ─────────────────────────────
router.get('/me/ai-chats', protect, getAiChats);

// ── PUT /users/me/ai-chats/:chatId ─────────────────────
router.get('/me/ai-chats/:chatId', protect, getAiChat);
router.post('/me/ai-chats/:chatId/messages', protect, appendAiMessages);
router.put('/me/ai-chats/:chatId', protect, validateBody(aiChatUpdateSchema), updateAiChat);

// ── DELETE /users/me/ai-chats/:chatId ──────────────────
router.delete('/me/ai-chats/:chatId', protect, deleteAiChat);

// ── GET /users/me/notification-preferences ─────────────
router.get('/me/notification-preferences', protect, getNotificationPreferences);

// ── PATCH /users/me/notification-preferences ───────────
router.patch('/me/notification-preferences', protect, updateNotificationPreferences);

// ── GET /users/me/daily-practice-reminder ──────────────
router.get('/me/daily-practice-reminder', protect, getDailyPracticeReminder);

// ── PATCH /users/me/daily-practice-reminder ────────────
router.patch('/me/daily-practice-reminder', protect, updateDailyPracticeReminder);

// ── GET /users/me/study-goal ──────────────
router.get('/me/study-goal', protect, getStudyGoal);

// ── PATCH /users/me/study-goal ────────────
router.patch('/me/study-goal', protect, updateStudyGoal);

export default router;
