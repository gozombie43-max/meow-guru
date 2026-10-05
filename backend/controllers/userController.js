import { canonicalQuestionUid } from '../services/questions/questionIdentity.js';
// backend/controllers/userController.js
import { z } from 'zod';
import { DateTime, IANAZone } from 'luxon';
import {
  getUser,
  updateUser,
  updateUserProgress,
  trackStudyUsage,
  mutateUserList,
  findQuestionForBookmark,
} from '../repositories/userRepository.js';
import { profileProjection, chatSummary, appendChatMessages, mergeQuizEntry } from '../services/userHistory.js';
import {
  computeNextDailyReminder,
  isValidTimezone,
  DEFAULT_DAILY_REMINDER_TIME,
} from '../services/dailyPracticeReminderService.js';

const DEFAULT_NOTIFICATION_PREFERENCES = {
  enabled: true,
  battleInvites: true,
  battleResults: true,
  dailyPractice: true,
  newMocks: true,
  examUpdates: true,
  announcements: true,
};

const notificationPreferencesSchema = z
  .object({
    enabled: z.boolean().optional(),
    battleInvites: z.boolean().optional(),
    battleResults: z.boolean().optional(),
    dailyPractice: z.boolean().optional(),
    newMocks: z.boolean().optional(),
    examUpdates: z.boolean().optional(),
    announcements: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one preference is required',
  });

const dailyReminderSchema = z.object({
  enabled: z.boolean(),
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  timezone: z.string().trim().min(1).max(100),
  streakProtectionEnabled: z.boolean().optional().default(false),
  streakProtectionTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .default('21:30'),
});

const studyGoalSchema = z.object({
  dailyGoalMinutes: z.number().int().min(5).max(240),
});

export const getMe = async (req, res) => {
  try {
    const user = await getUser(req.user.id, profileProjection);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { passwordHash, _id, _cosmosRid, ...safeUser } = user;
    safeUser.role = safeUser.role || req.user.role || 'user';
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateProfile = async (req, res) => {
  const { name, avatar, phone } = req.body;
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const fieldsToUpdate = {};
    if (typeof name === 'string' && name.trim().length > 0) {
      fieldsToUpdate.name = name.trim();
    }
    if (avatar !== undefined) {
      fieldsToUpdate.avatar = avatar === '' ? null : avatar;
    }
    if (phone !== undefined) {
      fieldsToUpdate.phone = phone === '' ? null : phone;
    }

    if (Object.keys(fieldsToUpdate).length > 0) {
      await updateUser(user.id, fieldsToUpdate);
    }

    const updatedUser = await getUser(req.user.id, profileProjection);
    const { passwordHash, _id, _cosmosRid, ...safeUser } = updatedUser;
    safeUser.role = safeUser.role || req.user.role || 'user';
    res.json({ message: 'Profile updated ✅', user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const updateBookmarks = async (req, res) => {
  const { questionId, action, meta } = req.body;
  try {
    const now = new Date().toISOString();
    const question = await findQuestionForBookmark(req.body.questionUid || questionId, meta || {});
    if (!question) return res.status(404).json({ error: "Question not found" });
    const safeId = canonicalQuestionUid(question);
    const metaObj = meta && typeof meta === 'object' ? meta : null;

    const patch = {
      questionId: safeId,
      questionUid: safeId,
      updatedAt: now,
    };

    if (metaObj) {
      if (typeof metaObj.quizKey === 'string') patch.quizKey = metaObj.quizKey;
      if (typeof metaObj.title === 'string') patch.title = metaObj.title;
      if (typeof metaObj.subject === 'string') patch.subject = metaObj.subject;
      if (typeof metaObj.slug === 'string') patch.slug = metaObj.slug;
      if (typeof metaObj.href === 'string') patch.href = metaObj.href;
      if (typeof metaObj.mode === 'string') patch.mode = metaObj.mode;
      if (Number.isFinite(Number(metaObj.questionIndex))) {
        patch.questionIndex = Math.max(0, parseInt(metaObj.questionIndex, 10));
      }
    }

    const bookmarkEntries = await mutateUserList(req.user.id, 'bookmarkEntries', entries => {
      let next = [...entries];
      if (action === 'add') {
        const existingIndex = next.findIndex((b) => b.questionId === safeId);
        if (existingIndex >= 0) {
          next[existingIndex] = { ...next[existingIndex], ...patch };
        } else {
          next.unshift(patch);
        }
      } else if (action === 'remove') {
        next = next.filter((b) => b.questionId !== safeId);
      }
      return next
        .filter((b) => b && b.questionId)
        .sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0))
        .slice(0, 60);
    });

    if (!bookmarkEntries) return res.status(404).json({ error: 'User not found' });
    
    const bookmarks = bookmarkEntries.map(e => e.questionId);
    
    // Also sync the simple bookmarks array just for the users collection
    await updateUser(req.user.id, { bookmarks });
    
    res.json({ message: 'Bookmarks updated ✅', bookmarks, bookmarkEntries });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message, code: err.code });
  }
};

export const updateProgress = async (req, res) => {
  const { topic, attempted, correct } = req.body;
  try {
    const updatedUser = await updateUserProgress(req.user.id, topic, attempted, correct);
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Progress updated ✅', progress: updatedUser.progress || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getRecentQuiz = async (req, res) => {
  try {
    const user = await getUser(req.user.id, { recentQuizzes: 1 });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const quiz = user.recentQuizzes?.find(entry => entry.quizKey === req.params.quizKey);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
    return res.json({ quiz });
  } catch (error) { return res.status(500).json({ error: error.message }); }
};

export const updateRecentQuizzes = async (req, res) => {
  try {
    const recentQuizzes = await mutateUserList(req.user.id, 'recentQuizzes', entries => {
      const previous = entries.find(entry => entry.quizKey === req.body.quizKey);
      const entry = mergeQuizEntry(previous, req.body);
      return [entry, ...entries.filter(row => row.quizKey !== entry.quizKey)].slice(0, 12);
    });
    if (!recentQuizzes) return res.status(404).json({ error: 'User not found' });
    return res.json({ saved: true });
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
};

export const updateUsage = async (req, res) => {
  const { activeSeconds, timezone } = req.body;
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const savedTimezone = user.dailyPracticeReminder?.timezone;
    const requestedTimezone = timezone && IANAZone.isValidZone(timezone) ? timezone : null;
    const effectiveTimezone = requestedTimezone || savedTimezone || 'UTC';
    const dateKey = DateTime.now().setZone(effectiveTimezone).toISODate();

    await trackStudyUsage(user.id, activeSeconds, effectiveTimezone, dateKey);
    return res.json({ message: 'Usage tracked ✅', dateKey });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getAiChats = async (req, res) => {
  try {
    const user = await getUser(req.user.id, { aiChats: 1 });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const aiChats = Array.isArray(user.aiChats) ? user.aiChats : [];
    const safeChats = aiChats
      .filter((chat) => chat && chat.id && Array.isArray(chat.messages))
      .sort((a, b) => (Date.parse(b.updatedAt || '') || 0) - (Date.parse(a.updatedAt || '') || 0))
      .slice(0, 30);

    res.json({ aiChats: safeChats.map(chatSummary) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAiChat = async (req, res) => {
  try {
    const user = await getUser(req.user.id, { aiChats: 1 });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const chat = user.aiChats?.find(entry => entry.id === req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    return res.json({ aiChat: { ...chat, revision: chat.revision ?? chat.messages.length } });
  } catch (error) { return res.status(500).json({ error: error.message }); }
};

const appendMessagesSchema = z.object({
  title: z.string().trim().max(80).optional(),
  sequence: z.number().int().positive(),
  messages: z.array(z.object({ role: z.enum(['user', 'bot']), content: z.string().max(12000) })).min(1).max(80),
});

export const appendAiMessages = async (req, res) => {
  const parsed = appendMessagesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid chat messages' });
  try {
    let revision;
    const chats = await mutateUserList(req.user.id, 'aiChats', entries => {
      const result = appendChatMessages(entries, req.params.chatId, parsed.data);
      revision = result.revision;
      return result.chats;
    });
    if (!chats) return res.status(404).json({ error: 'User not found' });
    return res.json({ saved: true, revision });
  } catch (error) { return res.status(error.statusCode || 500).json({ error: error.message }); }
};

export const updateAiChat = async (req, res) => {
  const { chatId } = req.params;
  const { title, messages } = req.body;

  if (!chatId) return res.status(400).json({ error: 'chatId is required' });
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

  const safeMessages = messages
    .filter((message) => message && (message.role === 'bot' || message.role === 'user') && typeof message.content === 'string')
    .slice(-80)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 12000),
    }));

  if (safeMessages.length === 0) {
    return res.status(400).json({ error: 'at least one valid message is required' });
  }

  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updatedAt = new Date().toISOString();
    const safeTitle = typeof title === 'string' && title.trim() ? title.trim().slice(0, 80) : 'New chat';

    const entry = { id: String(chatId), title: safeTitle, messages: safeMessages, revision: safeMessages.length, updatedAt };

    await mutateUserList(user.id, 'aiChats', chats =>
      [entry, ...chats.filter(chat => chat && chat.id && chat.id !== entry.id && Array.isArray(chat.messages))].slice(0, 30));
    res.json({ saved: true, revision: safeMessages.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const deleteAiChat = async (req, res) => {
  const { chatId } = req.params;
  if (!chatId) return res.status(400).json({ error: 'chatId is required' });

  try {
    const user = await getUser(req.user.id, { aiChats: 1 });
    if (!user) return res.status(404).json({ error: 'User not found' });

    await mutateUserList(req.user.id, 'aiChats', chats => chats.filter(chat => chat && chat.id !== chatId).slice(0, 30));
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getNotificationPreferences = async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(user.notificationPreferences || {}),
    };
    return res.json({ preferences });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateNotificationPreferences = async (req, res) => {
  try {
    const parsed = notificationPreferencesSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid notification preferences' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const preferences = {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      ...(user.notificationPreferences || {}),
      ...parsed.data,
    };

    await updateUser(user.id, {
      notificationPreferences: preferences,
      notificationPreferencesUpdatedAt: new Date(),
    });

    return res.json({ ok: true, preferences });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getDailyPracticeReminder = async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const reminder = user.dailyPracticeReminder || {};
    return res.json({
      reminder: {
        enabled: reminder.enabled === true,
        time: reminder.time || DEFAULT_DAILY_REMINDER_TIME,
        timezone: reminder.timezone || null,
        nextSendAt: reminder.nextSendAt || null,
        lastSentAt: reminder.lastSentAt || null,
        streakProtectionEnabled: reminder.streakProtectionEnabled === true,
        streakProtectionTime: reminder.streakProtectionTime || '21:30',
        nextStreakProtectionAt: reminder.nextStreakProtectionAt || null,
        lastStreakProtectionSentAt: reminder.lastStreakProtectionSentAt || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateDailyPracticeReminder = async (req, res) => {
  try {
    const parsed = dailyReminderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid reminder settings' });

    const { enabled, time, timezone, streakProtectionEnabled, streakProtectionTime } = parsed.data;

    if (!isValidTimezone(timezone)) return res.status(400).json({ error: 'Invalid timezone' });

    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const nextSendAt = enabled ? computeNextDailyReminder({ time, timezone }) : null;
    const nextStreakProtectionAt = streakProtectionEnabled ? computeNextDailyReminder({ time: streakProtectionTime, timezone }) : null;

    const reminder = {
      enabled, time, timezone, nextSendAt, streakProtectionEnabled, streakProtectionTime, nextStreakProtectionAt, updatedAt: new Date(),
    };

    await updateUser(user.id, { dailyPracticeReminder: reminder });
    return res.json({ ok: true, reminder });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getStudyGoal = async (req, res) => {
  try {
    const user = await getUser(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ dailyGoalMinutes: user.dailyGoalMinutes ?? 30 });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateStudyGoal = async (req, res) => {
  try {
    const parsed = studyGoalSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid daily goal' });

    const matched = await updateUser(req.user.id, {
      dailyGoalMinutes: parsed.data.dailyGoalMinutes,
      studyGoalUpdatedAt: new Date(),
    });

    if (!matched) return res.status(404).json({ error: 'User not found' });

    return res.json({ ok: true, dailyGoalMinutes: parsed.data.dailyGoalMinutes });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
