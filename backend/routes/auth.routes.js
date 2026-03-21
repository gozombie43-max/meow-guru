// backend/routes/auth.routes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import passport from '../auth/passport.js';
import { signToken } from '../auth/jwt.js';

const router = express.Router();
let usersContainer;

export const initAuthRoutes = (container) => {
  usersContainer = container;
  return router;
};

// ── POST /auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  try {
    // Check existing
    const { resources } = await usersContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.email = @email',
        parameters: [{ name: '@email', value: email }],
      })
      .fetchAll();

    if (resources.length > 0)
      return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = {
      id:           `user-${uuid()}`,
      name,
      email,
      authProvider: 'local',
      passwordHash,
      progress:     {},
      bookmarks:    [],
      createdAt:    new Date().toISOString(),
    };

    await usersContainer.items.create(user);

    const token = signToken({ id: user.id, email: user.email, name: user.name });

    res.status(201).json({
      message: 'Registered ✅',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /auth/login ────────────────────────────────────
router.post('/login', (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err)   return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Login failed' });

    const token = signToken({ id: user.id, email: user.email, name: user.name });

    res.json({
      message: 'Logged in ✅',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  })(req, res, next);
});

// ── GET /auth/google ────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// ── GET /auth/google/callback ───────────────────────────
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token = signToken({
      id:    req.user.id,
      email: req.user.email,
      name:  req.user.name,
    });

    // Redirect to frontend with token in query param
    // Frontend reads it once and stores in localStorage
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

export default router;