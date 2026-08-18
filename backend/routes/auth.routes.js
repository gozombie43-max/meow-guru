// backend/routes/auth.routes.js
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import passport from '../auth/passport.js';
import { signToken, signRefreshToken, verifyRefreshToken } from '../auth/jwt.js';
import { validateBody } from '../middleware/validation.js';
import { registerSchema, loginSchema } from '../schemas/apiSchemas.js';

const router = express.Router();
let usersContainer;

export const initAuthRoutes = (container) => {
  usersContainer = container;
  return router;
};

const isProd = process.env.NODE_ENV === 'production'
  || process.env.RENDER === 'true'
  || Boolean(process.env.RENDER_EXTERNAL_URL);

const refreshTokenMode = process.env.REFRESH_TOKEN_MODE || 'cookie';
const sendRefreshTokenInBody = refreshTokenMode === 'body' || refreshTokenMode === 'both';
const setRefreshCookie = refreshTokenMode === 'cookie' || refreshTokenMode === 'both';

const cookieOptions = {
  httpOnly: true,
  secure:   isProd,
  sameSite: isProd ? 'none' : 'lax',
  path:     '/',
  maxAge:   365 * 24 * 60 * 60 * 1000,
};

const getRefreshTokenFromRequest = (req) => {
  const headerToken = req.headers['x-refresh-token'];
  const bodyToken = req.body?.refreshToken;

  if (req.cookies?.refreshToken) return req.cookies.refreshToken;
  if (Array.isArray(headerToken)) return headerToken[0];
  if (typeof headerToken === 'string') return headerToken;
  if (typeof bodyToken === 'string') return bodyToken;
  return null;
};

const applyRefreshToken = (res, refreshToken) => {
  if (setRefreshCookie) {
    res.cookie('refreshToken', refreshToken, cookieOptions);
  }
};

const withRefreshToken = (payload, refreshToken) => (
  sendRefreshTokenInBody ? { ...payload, refreshToken } : payload
);

// ── POST /auth/register ─────────────────────────────────
router.post('/register', validateBody(registerSchema), async (req, res) => {
  const { name, email, password } = req.body;
  const emailLockId = `email_${email.toLowerCase()}`;
  let lockAcquired = false;

  try {
    // Attempt to create a lock document for the email to prevent race conditions
    try {
      await usersContainer.items.create({
        id: emailLockId,
        type: 'email_lock',
        email: email.toLowerCase(),
        createdAt: new Date().toISOString()
      });
      lockAcquired = true;
    } catch (err) {
      if (err.code === 409) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      throw err;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = {
      id:           `user-${uuid()}`,
      name,
      email:        email.toLowerCase(),
      role:         'student',
      authProvider: 'local',
      passwordHash,
      progress:     {},
      bookmarks:    [],
      bookmarkEntries: [],
      recentQuizzes: [],
      createdAt:    new Date().toISOString(),
    };

    await usersContainer.items.create(user);

    const token        = signToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email, name: user.name, role: user.role });

    applyRefreshToken(res, refreshToken);
    res.status(201).json(withRefreshToken({
      message: 'Registered ✅',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    }, refreshToken));
  } catch (err) {
    if (lockAcquired) {
      try {
        await usersContainer.item(emailLockId, email.toLowerCase()).delete();
      } catch { /* ignore rollback failure */ }
    }
    res.status(500).json({ error: err.message });
  }
});

// ── POST /auth/login ────────────────────────────────────
router.post('/login', validateBody(loginSchema), (req, res, next) => {
  passport.authenticate('local', { session: false }, (err, user, info) => {
    if (err)   return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Login failed' });

    const token        = signToken({ id: user.id, email: user.email, name: user.name, role: user.role || 'student' });
    const refreshToken = signRefreshToken({ id: user.id, email: user.email, name: user.name, role: user.role || 'student' });

    applyRefreshToken(res, refreshToken);
    res.json(withRefreshToken({
      message: 'Logged in ✅',
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role || 'student' },
    }, refreshToken));
  })(req, res, next);
});

// ── POST /auth/refresh ──────────────────────────────────
router.post('/refresh', (req, res) => {
  const token = getRefreshTokenFromRequest(req);
  if (!token) return res.status(401).json({ error: 'Not logged in' });

  try {
    const decoded = verifyRefreshToken(token);
    const payload = { id: decoded.id, email: decoded.email, name: decoded.name };
    const newToken = signToken(payload);
    const newRefreshToken = signRefreshToken(payload);
    applyRefreshToken(res, newRefreshToken);
    res.json(withRefreshToken({ token: newToken }, newRefreshToken));
  } catch {
    if (setRefreshCookie) {
      res.clearCookie('refreshToken', cookieOptions);
    }
    res.status(403).json({ error: 'Session expired, please login again' });
  }
});

// ── POST /auth/logout ───────────────────────────────────
router.post('/logout', (req, res) => {
  if (setRefreshCookie) {
    res.clearCookie('refreshToken', cookieOptions);
  }
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

    applyRefreshToken(res, refreshToken);
    const encodedToken = encodeURIComponent(token);
    const encodedRefresh = encodeURIComponent(refreshToken);
    const redirectUrl = sendRefreshTokenInBody
      ? `${process.env.FRONTEND_URL}/auth/callback?token=${encodedToken}&refreshToken=${encodedRefresh}`
      : `${process.env.FRONTEND_URL}/auth/callback?token=${encodedToken}`;
    res.redirect(redirectUrl);
  }
);

export default router;
