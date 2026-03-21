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

export default router;