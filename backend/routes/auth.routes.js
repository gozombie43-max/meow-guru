import { runtimeLog } from '../infrastructure/runtimeLog.js';
// backend/routes/auth.routes.js

import express from 'express';
import firebaseAuthRoutes from './firebaseAuth.routes.js';
import { requireTrustedOrigin } from '../auth/requestOrigin.js';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

import passport from '../auth/passport.js';

import {
  verifyToken,
  verifyRefreshToken,
} from '../auth/jwt.js';

import { createSession, rotateSession, revokeSession } from '../auth/sessions.js';

import { validateBody } from '../middleware/validation.js';
import {
  registerSchema,
  loginSchema,
} from '../schemas/apiSchemas.js';

import { findUserByEmail, acquireRegistrationLock, releaseRegistrationLock, insertRegisteredUser, verifyLocalUserEmailByTokenHash, replaceEmailVerificationToken } from '../repositories/authRegistrationRepository.js';
import { createEmailVerificationToken, hashEmailVerificationToken } from '../services/email/emailVerification.js';
import { sendVerificationEmail } from '../services/email/sendVerificationEmail.js';

const router = express.Router();
router.use('/firebase', firebaseAuthRoutes);

/*
 * Kept as an init function so index.js does not need
 * to change yet. Any old argument passed to it is ignored.
 */
export const initAuthRoutes = () => router;

const isProd =
  process.env.NODE_ENV === 'production' ||
  process.env.RENDER === 'true' ||
  Boolean(process.env.RENDER_EXTERNAL_URL);

const frontendUrl =
  process.env.FRONTEND_URL ||
  'http://localhost:3000';

const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  path: '/',

};

const getRefreshTokenFromRequest = (req) =>
  req.cookies?.refreshToken || null;

const applyRefreshToken = (
  res,
  refreshToken
) => {
  res.cookie(
    'refreshToken',
    refreshToken,
    { ...cookieOptions, maxAge: Math.max(0, verifyRefreshToken(refreshToken).exp * 1000 - Date.now()) }
  );
};

/*
 * Ignore old Cosmos email_lock documents when
 * looking for an actual user.
 */



// ── POST /auth/register ─────────────────────────────────

router.post(
  '/register',
  validateBody(registerSchema),

  async (req, res) => {
    const {
      name,
      email,
      password,
    } = req.body;

    const normalizedEmail =
      String(email)
        .trim()
        .toLowerCase();

    /*
     * Use a dedicated MongoDB collection for
     * atomic registration locks.
     *
     * MongoDB's _id is inherently unique, so two
     * simultaneous registrations for the same email
     * cannot both acquire this lock.
     */


    let lockAcquired = false;

    try {
      // ── Acquire email registration lock ───────────────

      try {
        await acquireRegistrationLock(normalizedEmail);

        lockAcquired = true;

      } catch (err) {
        if (err?.code === 11000) {
          return res
            .status(409)
            .json({
              error:
                'Email already registered',
            });
        }

        throw err;
      }


      // ── Check existing real user ──────────────────────

      const existing =
        await findUserByEmail(
          normalizedEmail
        );

      if (existing) {
        return res
          .status(409)
          .json({
            error:
              'Email already registered',
          });
      }


      // ── Create local user ─────────────────────────────

      const passwordHash =
        await bcrypt.hash(
          password,
          12
        );

      const {
        token: verificationToken,
        tokenHash: verificationTokenHash,
        expiresAt: verificationExpiresAt,
      } = createEmailVerificationToken();

      const user = {
        id: `user-${uuid()}`,

        name,

        email:
          normalizedEmail,

        role:
          'student',

        authProvider:
          'local',

        passwordHash,

        emailVerified: false,
        emailVerificationTokenHash: verificationTokenHash,
        emailVerificationExpiresAt: verificationExpiresAt,
        emailVerificationLastSentAt: new Date(),

        progress: {},

        bookmarks: [],

        bookmarkEntries: [],

        recentQuizzes: [],

        createdAt:
          new Date().toISOString(),
      };

      await insertRegisteredUser(user);

      try {
        await sendVerificationEmail(user, verificationToken, frontendUrl);
      } catch {
        // Avoid logging provider errors that could include verification URLs.
        runtimeLog.error('Verification email failed');
      }


      return res
        .status(201)
        .json({
          message:
            'Account created. Check your email to verify your account.',

          verificationRequired: true,

          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });

    } catch (err) {
      if (err.code === 11000) return res.status(409).json({ error: 'Account already exists', code: 'ACCOUNT_EXISTS' });
      runtimeLog.error(
        'Registration error:',
        err
      );

      return res
        .status(500)
        .json({
          error: 'Registration failed',
        });

    } finally {
      /*
       * Release temporary registration lock.
       *
       * Existing users are still protected by the
       * real-user lookup above.
       */
      if (lockAcquired) {
        try {
          await releaseRegistrationLock(normalizedEmail);
        } catch (err) {
          runtimeLog.warn(
            'Failed to release registration lock:',
            err.message
          );
        }
      }
    }
  }
);


// ── POST /auth/verify-email ─────────────────────────────

router.post('/resend-verification', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const genericResponse = {
    message: 'If an unverified account exists for this email, a verification link will be sent.',
  };
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.json(genericResponse);
  }
  try {
    const { token, tokenHash, expiresAt } = createEmailVerificationToken();
    const user = await replaceEmailVerificationToken({ email, tokenHash, expiresAt });
    if (user) await sendVerificationEmail(user, token, frontendUrl);
  } catch {
    // Neither account state nor provider/query details belong in the response or logs.
    runtimeLog.error('Resend verification email failed');
  }
  return res.json(genericResponse);
});

router.post('/verify-email', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    if (!token || token.length > 256) {
      return res.status(400).json({
        error: 'Invalid verification link',
        code: 'INVALID_VERIFICATION_TOKEN',
      });
    }

    const result = await verifyLocalUserEmailByTokenHash(hashEmailVerificationToken(token));
    if (result.modifiedCount !== 1) {
      return res.status(400).json({
        error: 'Verification link is invalid or has expired',
        code: 'INVALID_OR_EXPIRED_VERIFICATION_TOKEN',
      });
    }

    return res.json({ message: 'Email verified successfully', emailVerified: true });
  } catch {
    // Database errors may contain the token hash; keep verification secrets out of logs.
    runtimeLog.error('Email verification error');
    return res.status(500).json({ error: 'Unable to verify email' });
  }
});

// ── POST /auth/login ────────────────────────────────────

router.post(
  '/login',
  validateBody(loginSchema),

  (req, res, next) => {
    passport.authenticate(
      'local',
      {
        session: false,
      },

      async (
        err,
        user,
        info
      ) => {
        if (err) {
          return next(err);
        }

        if (!user) {
          if (info?.code === 'EMAIL_NOT_VERIFIED') {
            return res.status(403).json({
              error: 'Please verify your email before signing in',
              code: 'EMAIL_NOT_VERIFIED',
            });
          }
          return res
            .status(401)
            .json({
              error:
                'Invalid email or password',
            });
        }

        const payload = {
          id: user.id,
          email: user.email,
          name: user.name,
          role:
            user.role ||
            'student',
        };

        let token, refreshToken;
        try { ({ token, refreshToken } = await createSession(payload)); }
        catch (error) { return next(error); }

        applyRefreshToken(
          res,
          refreshToken
        );

        return res.json({
          message:
            'Logged in ✅',

          token,

          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role:
              user.role ||
              'student',
          },
        });
      }
    )(req, res, next);
  }
);


// ── POST /auth/refresh ──────────────────────────────────

router.post(
  '/refresh',
  requireTrustedOrigin,
  async (req, res) => {
    const token =
      getRefreshTokenFromRequest(
        req
      );

    if (!token) {
      return res
        .status(401)
        .json({
          error:
            'Not logged in',
        });
    }

    try {
      const { token: newToken, refreshToken: newRefreshToken } = await rotateSession(token);

      applyRefreshToken(
        res,
        newRefreshToken
      );

      return res.json({
        token: newToken,
      });

    } catch (error) {
      if (!error.statusCode && !['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) {
        return res.status(503).json({ error: 'Authentication service unavailable' });
      }
      res.clearCookie(
        'refreshToken',
        cookieOptions
      );

      return res
        .status(403)
        .json({
          error:
            'Session expired, please login again',
        });
    }
  }
);


// ── POST /auth/logout ───────────────────────────────────

router.post(
  '/logout',
  requireTrustedOrigin,
  async (req, res, next) => {
    try {
      const raw = getRefreshTokenFromRequest(req);
      let decoded;
      try { decoded = raw ? verifyRefreshToken(raw) : verifyToken(req.headers.authorization?.slice(7)); } catch {}
      if (!decoded) { try { decoded = verifyToken(req.headers.authorization?.slice(7)); } catch {} }
      await revokeSession(decoded);
    } catch (error) { return next(error); }
    res.clearCookie(
      'refreshToken',
      cookieOptions
    );

    res.json({
      message:
        'Logged out ✅',
    });
  }
);


// ── GET /auth/google ────────────────────────────────────

router.get(
  '/google',

  passport.authenticate(
    'google',
    {
      scope: [
        'profile',
        'email',
      ],
      session: false,
    }
  )
);


// ── GET /auth/google/callback ───────────────────────────

router.get(
  '/google/callback',

  passport.authenticate(
    'google',
    {
      session: false,

      failureRedirect:
        `${frontendUrl}/login?error=oauth`,
    }
  ),

  async (req, res) => {
    const { refreshToken } = await createSession({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role || 'user',
      });

    applyRefreshToken(
      res,
      refreshToken
    );

    res.redirect(
      `${frontendUrl}/auth/callback`
    );
  }
);

export default router;
