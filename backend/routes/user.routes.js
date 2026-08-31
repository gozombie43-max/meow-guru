// backend/routes/user.routes.js
import express from 'express';
import { getUsersCollection } from '../config/mongodb.js';
import { protect } from '../middleware/protect.js';
import { validateBody } from '../middleware/validation.js';
import {
  bookmarkPatchSchema,
  progressPatchSchema,
  recentQuizPatchSchema,
  studyTimePatchSchema,
} from '../schemas/apiSchemas.js';

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
    res.json(safeUser);
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
    const user = await getUser(req.user.id, req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const progress = user.progress || {};
    const current  = progress[topic] || { attempted: 0, correct: 0 };

    progress[topic] = {
      attempted: current.attempted + attempted,
      correct:   current.correct   + correct,
    };

    await updateUser(user.id, {
      progress,
    });

    res.json({ message: 'Progress updated ✅', progress });
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
router.patch('/me/usage', protect, validateBody(studyTimePatchSchema), async (req, res) => {
  const { activeSeconds } = req.body;

  try {
    const user = await getUser(req.user.id, req.user.email);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const currentStudyTime = user.studyTime || 0;
    const newStudyTime = currentStudyTime + activeSeconds;

    await updateUser(user.id, {
      studyTime: newStudyTime,
    });

    res.json({ message: 'Usage tracked ✅', studyTime: newStudyTime });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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

export default router;
