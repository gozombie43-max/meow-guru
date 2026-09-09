// backend/routes/user.routes.js
import express from 'express';
import { z } from 'zod';
import { DateTime, IANAZone } from 'luxon';
import {
  getUsersCollection,
  getStudyActivityDailyCollection,
} from '../config/mongodb.js';
import { protect } from '../middleware/protect.js';
import { validateBody } from '../middleware/validation.js';
import {
  bookmarkPatchSchema,
  profilePatchSchema,
  progressPatchSchema,
  recentQuizPatchSchema,
  studyTimePatchSchema,
} from '../schemas/apiSchemas.js';
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

  streakProtectionEnabled: z
    .boolean()
    .optional()
    .default(false),

  streakProtectionTime: z
    .string()
    .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
    .optional()
    .default('21:30'),
});

const studyGoalSchema = z.object({
  dailyGoalMinutes: z.number().int().min(5).max(240),
});

const router = express.Router();

export const initUserRoutes = () => router;

const getUser = async (id) => {
  const users = getUsersCollection();

  return users.findOne({
    id: String(id),
    type: { $ne: 'email_lock' },
  });
};

const updateUser = async (id, fields) => {
  const users = getUsersCollection();

  const result = await users.updateOne(
    {
      id: String(id),
      type: { $ne: 'email_lock' },
    },
    {
      $set: fields,
    }
  );

  return result.matchedCount > 0;
};

// ── GET /users/me ───────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await getUser(req.user.id, req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const {
      passwordHash,
      _id,
      _cosmosRid,
      ...safeUser
    } = user;
    safeUser.role = safeUser.role || req.user.role || 'user';
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /users/me/profile ─────────────────────────────
router.patch('/me/profile', protect, validateBody(profilePatchSchema), async (req, res) => {
  const { name, avatar, phone } = req.body;

  try {
    const user = await getUser(req.user.id, req.user.email);
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

    const updatedUser = await getUser(req.user.id, req.user.email);
    const { passwordHash, _id, _cosmosRid, ...safeUser } = updatedUser;
    safeUser.role = safeUser.role || req.user.role || 'user';
    res.json({ message: 'Profile updated ✅', user: safeUser });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /users/me/bookmarks ───────────────────────────
router.patch('/me/bookmarks', protect, validateBody(bookmarkPatchSchema), async (req, res) => {
  const { questionId, action, meta } = req.body;

  try {
    const user = await getUser(req.user.id, req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const now = new Date().toISOString();
    const safeId = String(questionId);
    const metaObj = meta && typeof meta === 'object' ? meta : null;

    let bookmarks = user.bookmarks || [];
    let bookmarkEntries = Array.isArray(user.bookmarkEntries)
      ? user.bookmarkEntries
      : [];

    const patch = {
      questionId: safeId,
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

    if (action === 'add') {
      if (!bookmarks.includes(safeId)) bookmarks.push(safeId);
      const existingIndex = bookmarkEntries.findIndex((b) => b.questionId === safeId);
      if (existingIndex >= 0) {
        bookmarkEntries[existingIndex] = {
          ...bookmarkEntries[existingIndex],
          ...patch,
        };
      } else {
        bookmarkEntries.unshift(patch);
      }
    } else if (action === 'remove') {
      bookmarks = bookmarks.filter(id => id !== safeId);
      bookmarkEntries = bookmarkEntries.filter((b) => b.questionId !== safeId);
    }

    bookmarkEntries = bookmarkEntries
      .filter((b) => b && b.questionId)
      .sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || '') || 0;
        const bTime = Date.parse(b.updatedAt || '') || 0;
        return bTime - aTime;
      })
      .slice(0, 60);

    await updateUser(user.id, {
      bookmarks,
      bookmarkEntries,
    });

    res.json({ message: 'Bookmarks updated ✅', bookmarks, bookmarkEntries });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /users/me/progress ────────────────────────────
router.patch('/me/progress', protect, validateBody(progressPatchSchema), async (req, res) => {
  const { topic, attempted, correct } = req.body;

  try {
    const users = getUsersCollection();
    const updatedUser = await users.findOneAndUpdate(
      { id: String(req.user.id), type: { $ne: 'email_lock' } },
      {
        $inc: {
          [`progress.${topic}.attempted`]: attempted,
          [`progress.${topic}.correct`]: correct,
        },
      },
      { returnDocument: 'after', projection: { progress: 1 } },
    );
    if (!updatedUser) return res.status(404).json({ error: 'User not found' });

    res.json({ message: 'Progress updated ✅', progress: updatedUser.progress || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /users/me/recent-quizzes ─────────────────────
router.patch('/me/recent-quizzes', protect, validateBody(recentQuizPatchSchema), async (req, res) => {
  const {
    quizKey,
    title,
    subject,
    slug,
    href,
    mode,
    currentIndex,
    totalQuestions,
    selectedAnswers,
    submittedQuestions,
    results,
    status,
  } = req.body;

  try {
    const user = await getUser(req.user.id, req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updatedAt = new Date().toISOString();
    const safeIndex = Number.isFinite(currentIndex) ? Math.max(0, currentIndex) : 0;
    const safeTotal = Number.isFinite(totalQuestions) ? Math.max(0, totalQuestions) : 0;
    const safeSelected =
      selectedAnswers && typeof selectedAnswers === 'object' ? selectedAnswers : {};
    const safeSubmitted = Array.isArray(submittedQuestions) ? submittedQuestions : [];
    const safeResults = Array.isArray(results) ? results : [];
    const safeStatus = status === 'completed' ? 'completed' : 'in-progress';

    const entry = {
      quizKey,
      title,
      subject,
      slug: slug || '',
      href,
      mode: mode || 'mixed',
      currentIndex: safeIndex,
      totalQuestions: safeTotal,
      selectedAnswers: safeSelected,
      submittedQuestions: safeSubmitted,
      results: safeResults,
      status: safeStatus,
      updatedAt,
    };

    let recentQuizzes = user.recentQuizzes || [];
    const existingIndex = recentQuizzes.findIndex((q) => q.quizKey === quizKey);

    if (existingIndex >= 0) {
      recentQuizzes[existingIndex] = { ...recentQuizzes[existingIndex], ...entry };
    } else {
      recentQuizzes.unshift(entry);
    }

    recentQuizzes = recentQuizzes
      .filter((q) => q && q.quizKey)
      .sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || '') || 0;
        const bTime = Date.parse(b.updatedAt || '') || 0;
        return bTime - aTime;
      })
      .slice(0, 12);

    await updateUser(user.id, {
      recentQuizzes,
    });

    res.json({ message: 'Recent quizzes updated ✅', recentQuizzes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /users/me/usage ──────────────────────────────
router.patch(
  '/me/usage',
  protect,
  validateBody(studyTimePatchSchema),
  async (req, res) => {
    const { activeSeconds, timezone } = req.body;

    try {
      const user = await getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const savedTimezone = user.dailyPracticeReminder?.timezone;
      const requestedTimezone =
        timezone && IANAZone.isValidZone(timezone) ? timezone : null;
      const effectiveTimezone = requestedTimezone || savedTimezone || 'UTC';

      const dateKey = DateTime.now().setZone(effectiveTimezone).toISODate();

      const users = getUsersCollection();
      const daily = getStudyActivityDailyCollection();

      await Promise.all([
        users.updateOne(
          { id: user.id },
          {
            $inc: { studyTime: activeSeconds },
            $set: { timezone: effectiveTimezone },
          }
        ),
        daily.updateOne(
          {
            userId: user.id,
            dateKey,
          },
          {
            $inc: { activeSeconds },
            $set: {
              timezone: effectiveTimezone,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              createdAt: new Date(),
            },
          },
          { upsert: true }
        ),
      ]);

      return res.json({
        message: 'Usage tracked ✅',
        dateKey,
      });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }
);

// ── GET /users/me/ai-chats ─────────────────────────────
router.get('/me/ai-chats', protect, async (req, res) => {
  try {
    const user = await getUser(req.user.id, req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const aiChats = Array.isArray(user.aiChats) ? user.aiChats : [];
    const safeChats = aiChats
      .filter((chat) => chat && chat.id && Array.isArray(chat.messages))
      .sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || '') || 0;
        const bTime = Date.parse(b.updatedAt || '') || 0;
        return bTime - aTime;
      })
      .slice(0, 30);

    res.json({ aiChats: safeChats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PUT /users/me/ai-chats/:chatId ─────────────────────
router.put('/me/ai-chats/:chatId', protect, async (req, res) => {
  const { chatId } = req.params;
  const { title, messages } = req.body;

  if (!chatId) return res.status(400).json({ error: 'chatId is required' });
  if (!Array.isArray(messages)) return res.status(400).json({ error: 'messages must be an array' });

  const safeMessages = messages
    .filter((message) => {
      return (
        message &&
        (message.role === 'bot' || message.role === 'user') &&
        typeof message.content === 'string'
      );
    })
    .slice(-80)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 12000),
    }));

  if (safeMessages.length === 0) {
    return res.status(400).json({ error: 'at least one valid message is required' });
  }

  try {
    const user = await getUser(req.user.id, req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const updatedAt = new Date().toISOString();
    const safeTitle = typeof title === 'string' && title.trim()
      ? title.trim().slice(0, 80)
      : 'New chat';

    const entry = {
      id: String(chatId),
      title: safeTitle,
      messages: safeMessages,
      updatedAt,
    };

    let aiChats = Array.isArray(user.aiChats) ? user.aiChats : [];
    const existingIndex = aiChats.findIndex((chat) => chat.id === entry.id);

    if (existingIndex >= 0) {
      aiChats[existingIndex] = { ...aiChats[existingIndex], ...entry };
    } else {
      aiChats.unshift(entry);
    }

    aiChats = aiChats
      .filter((chat) => chat && chat.id && Array.isArray(chat.messages))
      .sort((a, b) => {
        const aTime = Date.parse(a.updatedAt || '') || 0;
        const bTime = Date.parse(b.updatedAt || '') || 0;
        return bTime - aTime;
      })
      .slice(0, 30);

    await updateUser(user.id, {
      aiChats,
    });

    res.json({ message: 'AI chat saved ✅', aiChat: entry, aiChats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /users/me/ai-chats/:chatId ──────────────────
router.delete('/me/ai-chats/:chatId', protect, async (req, res) => {
  const { chatId } = req.params;

  if (!chatId) return res.status(400).json({ error: 'chatId is required' });

  try {
    const user = await getUser(req.user.id, req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const aiChats = (Array.isArray(user.aiChats) ? user.aiChats : [])
      .filter((chat) => chat && chat.id !== chatId)
      .slice(0, 30);

    await updateUser(user.id, {
      aiChats,
    });

    res.json({ message: 'AI chat deleted ✅', aiChats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /users/me/notification-preferences ─────────────
router.get(
  "/me/notification-preferences",
  protect,
  async (req, res) => {
    try {
      const user = await getUser(req.user.id);

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const preferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,

        ...(user.notificationPreferences || {}),
      };

      return res.json({
        preferences,
      });
    } catch (error) {
      return res.status(500).json({
        error: error.message,
      });
    }
  }
);

// ── PATCH /users/me/notification-preferences ───────────
router.patch(
  "/me/notification-preferences",
  protect,
  async (req, res) => {
    try {
      const parsed = notificationPreferencesSchema.safeParse(req.body);

      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid notification preferences",
        });
      }

      const user = await getUser(req.user.id);

      if (!user) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      const preferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,

        ...(user.notificationPreferences || {}),

        ...parsed.data,
      };

      await updateUser(user.id, {
        notificationPreferences: preferences,

        notificationPreferencesUpdatedAt: new Date(),
      });

      return res.json({
        ok: true,
        preferences,
      });
    } catch (error) {
      return res.status(500).json({
        error: error.message,
      });
    }
  }
);

// ── GET /users/me/daily-practice-reminder ──────────────
router.get(
  "/me/daily-practice-reminder",
  protect,
  async (req, res) => {
    try {
      const user =
        await getUser(
          req.user.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            error:
              "User not found",
          });
      }

      const reminder =
        user.dailyPracticeReminder ||
        {};

      return res.json({
        reminder: {
          enabled:
            reminder.enabled ===
            true,

          time:
            reminder.time ||
            DEFAULT_DAILY_REMINDER_TIME,

          timezone:
            reminder.timezone ||
            null,

          nextSendAt:
            reminder.nextSendAt ||
            null,

          lastSentAt:
            reminder.lastSentAt ||
            null,

          streakProtectionEnabled:
            reminder.streakProtectionEnabled ===
            true,

          streakProtectionTime:
            reminder.streakProtectionTime ||
            "21:30",

          nextStreakProtectionAt:
            reminder.nextStreakProtectionAt ||
            null,

          lastStreakProtectionSentAt:
            reminder.lastStreakProtectionSentAt ||
            null,
        },
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          error:
            error.message,
        });
    }
  }
);

// ── PATCH /users/me/daily-practice-reminder ────────────
router.patch(
  "/me/daily-practice-reminder",
  protect,
  async (req, res) => {
    try {
      const parsed =
        dailyReminderSchema
          .safeParse(
            req.body
          );

      if (!parsed.success) {
        return res
          .status(400)
          .json({
            error:
              "Invalid reminder settings",
          });
      }

      const {
        enabled,
        time,
        timezone,
        streakProtectionEnabled,
        streakProtectionTime,
      } =
        parsed.data;

      if (
        !isValidTimezone(
          timezone
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid timezone",
          });
      }

      const user =
        await getUser(
          req.user.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            error:
              "User not found",
          });
      }

      const nextSendAt =
        enabled
          ? computeNextDailyReminder({
              time,
              timezone,
            })
          : null;

      const nextStreakProtectionAt =
        streakProtectionEnabled
          ? computeNextDailyReminder({
              time:
                streakProtectionTime,
              timezone,
            })
          : null;

      const reminder = {
        enabled,
        time,
        timezone,

        nextSendAt,

        streakProtectionEnabled,

        streakProtectionTime,

        nextStreakProtectionAt,

        updatedAt:
          new Date(),
      };

      await updateUser(
        user.id,
        {
          dailyPracticeReminder:
            reminder,
        }
      );

      return res.json({
        ok: true,
        reminder,
      });
    } catch (error) {
      return res
        .status(500)
        .json({
          error:
            error.message,
        });
    }
  }
);

router.get(
  "/me/study-goal",
  protect,
  async (req, res) => {
    try {
      const user =
        await getUser(
          req.user.id
        );

      if (!user) {
        return res
          .status(404)
          .json({
            error:
              "User not found",
          });
      }

      return res.json({
        dailyGoalMinutes:
          user.dailyGoalMinutes ??
          30,
      });

    } catch (error) {
      return res
        .status(500)
        .json({
          error:
            error.message,
        });
    }
  }
);

router.patch(
  "/me/study-goal",
  protect,
  async (req, res) => {
    try {
      const parsed =
        studyGoalSchema
          .safeParse(
            req.body
          );

      if (!parsed.success) {
        return res
          .status(400)
          .json({
            error:
              "Invalid daily goal",
          });
      }

      const matched =
        await updateUser(
          req.user.id,
          {
            dailyGoalMinutes:
              parsed.data
                .dailyGoalMinutes,

            studyGoalUpdatedAt:
              new Date(),
          }
        );

      if (!matched) {
        return res
          .status(404)
          .json({
            error:
              "User not found",
          });
      }

      return res.json({
        ok: true,

        dailyGoalMinutes:
          parsed.data
            .dailyGoalMinutes,
      });

    } catch (error) {
      return res
        .status(500)
        .json({
          error:
            error.message,
        });
    }
  }
);

export default router;
