// backend/routes/user.routes.js
import express from 'express';
import { protect } from '../middleware/protect.js';

const router = express.Router();
let usersContainer;

export const initUserRoutes = (container) => {
  usersContainer = container;
  return router;
};

// helper: fetch user by id (cross-partition query)
const getUserById = async (id) => {
  const { resources } = await usersContainer.items
    .query({
      query: 'SELECT * FROM c WHERE c.id = @id',
      parameters: [{ name: '@id', value: id }],
    })
    .fetchAll();
  return resources[0];
};

// ── GET /users/me ───────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const { passwordHash, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /users/me/bookmarks ───────────────────────────
// body: { questionId: "cgl-t2-algebra-62", action: "add" | "remove" }
router.patch('/me/bookmarks', protect, async (req, res) => {
  const { questionId, action } = req.body;

  if (!questionId || !action)
    return res.status(400).json({ error: 'questionId and action required' });

  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    let bookmarks = user.bookmarks || [];

    if (action === 'add') {
      if (!bookmarks.includes(questionId)) bookmarks.push(questionId);
    } else if (action === 'remove') {
      bookmarks = bookmarks.filter(id => id !== questionId);
    } else {
      return res.status(400).json({ error: 'action must be "add" or "remove"' });
    }

    await usersContainer.items.upsert({ ...user, bookmarks });

    res.json({ message: 'Bookmarks updated ✅', bookmarks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /users/me/progress ────────────────────────────
// body: { topic: "Algebra", attempted: 1, correct: 1 }
router.patch('/me/progress', protect, async (req, res) => {
  const { topic, attempted, correct } = req.body;

  if (!topic || attempted === undefined || correct === undefined)
    return res.status(400).json({ error: 'topic, attempted, correct required' });

  try {
    const user = await getUserById(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const progress = user.progress || {};
    const current  = progress[topic] || { attempted: 0, correct: 0 };

    progress[topic] = {
      attempted: current.attempted + attempted,
      correct:   current.correct   + correct,
    };

    await usersContainer.items.upsert({ ...user, progress });

    res.json({ message: 'Progress updated ✅', progress });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /users/me/recent-quizzes ─────────────────────
// body: { quizKey, title, subject, slug?, href, mode?, currentIndex?, totalQuestions?, selectedAnswers?, submittedQuestions?, results?, status? }
router.patch('/me/recent-quizzes', protect, async (req, res) => {
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

  if (!quizKey || !title || !subject || !href)
    return res.status(400).json({ error: 'quizKey, title, subject, href required' });

  try {
    const user = await getUserById(req.user.id);
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

    await usersContainer.items.upsert({ ...user, recentQuizzes });

    res.json({ message: 'Recent quizzes updated ✅', recentQuizzes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;