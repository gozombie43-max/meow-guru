// backend/routes/auth.routes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import passport from '../auth/passport.js';
import { signToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';

const router = express.Router();
let usersContainer;

export const initAuthRoutes = (container) => {
  usersContainer = container;
  return router;
};

const isProd = process.env.NODE_ENV === 'production'
  || process.env.RENDER === 'true'
  || Boolean(process.env.RENDER_EXTERNAL_URL);

const cookieOptions = {
  httpOnly: true,
  secure:   isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge:   365 * 24 * 60 * 60 * 1000,
};

// ── POST /auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });

  try {
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
      name, email,
      authProvider: 'local',
      passwordHash,
      progress:     {},
      bookmarks:    [],
      createdAt:    new Date().toISOString(),
    };

    await usersContainer.items.create(user);

    const token        = signToken({ id: user.id, email: user.email, name: user.name });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email, name: user.name });

    res.cookie('refreshToken', refreshToken, cookieOptions);
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

    const token        = signToken({ id: user.id, email: user.email, name: user.name });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email, name: user.name });

    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.json({
      message: 'Logged in ✅',
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  })(req, res, next);
});

// ── POST /auth/refresh ──────────────────────────────────
router.post('/refresh', (req, res) => {
  const token = req.cookies.refreshToken;
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    const decoded = verifyRefreshToken(token);
    const newToken = signToken({ id: decoded.id, email: decoded.email, name: decoded.name });
    res.json({ token: newToken });
  } catch {
    res.clearCookie('refreshToken');
    res.status(403).json({ error: 'Session expired, please login again' });
  }
});

// ── POST /auth/logout ───────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out ✅' });
});

// ── GET /auth/google ────────────────────────────────────
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// ── GET /auth/google/callback ───────────────────────────
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  (req, res) => {
    const token        = signToken({ id: req.user.id, email: req.user.email, name: req.user.name });
    const refreshToken = signRefreshToken({ id: req.user.id, email: req.user.email, name: req.user.name });

    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
  }
);

export default router;