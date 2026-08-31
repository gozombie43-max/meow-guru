// backend/routes/auth.routes.js

import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';

import passport from '../auth/passport.js';

import {
  signToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../auth/jwt.js';

import { validateBody } from '../middleware/validation.js';
import {
  registerSchema,
  loginSchema,
} from '../schemas/apiSchemas.js';

import {
  getUsersCollection,
  getMongoDB,
} from '../config/mongodb.js';

const router = express.Router();

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
  maxAge:
    365 *
    24 *
    60 *
    60 *
    1000,
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
    cookieOptions
  );
};

/*
 * Ignore old Cosmos email_lock documents when
 * looking for an actual user.
 */
async function findUserByEmail(email) {
  const users =
    getUsersCollection();

  return users.findOne({
    email: String(email)
      .trim()
      .toLowerCase(),

    type: {
      $ne: 'email_lock',
    },
  });
}


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
    const registrationLocks =
      getMongoDB().collection(
        'registrationLocks'
      );

    let lockAcquired = false;

    try {
      // ── Acquire email registration lock ───────────────

      try {
        await registrationLocks.insertOne({
          _id: normalizedEmail,
          createdAt:
            new Date().toISOString(),
        });

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

        progress: {},

        bookmarks: [],

        bookmarkEntries: [],

        recentQuizzes: [],

        createdAt:
          new Date().toISOString(),
      };

      const users =
        getUsersCollection();

      await users.insertOne(user);


      // ── Create auth tokens ─────────────────────────────

      const payload = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      };

      const token =
        signToken(payload);

      const refreshToken =
        signRefreshToken(payload);

      applyRefreshToken(
        res,
        refreshToken
      );

      return res
        .status(201)
        .json({
          message:
            'Registered ✅',

          token,

          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
          },
        });

    } catch (err) {
      console.error(
        'Registration error:',
        err
      );

      return res
        .status(500)
        .json({
          error: err.message,
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
          await registrationLocks.deleteOne({
            _id: normalizedEmail,
          });
        } catch (err) {
          console.warn(
            'Failed to release registration lock:',
            err.message
          );
        }
      }
    }
  }
);


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

      (
        err,
        user,
        info
      ) => {
        if (err) {
          return next(err);
        }

        if (!user) {
          return res
            .status(401)
            .json({
              error:
                info?.message ||
                'Login failed',
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

        const token =
          signToken(payload);

        const refreshToken =
          signRefreshToken(
            payload
          );

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
  (req, res) => {
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
      const decoded =
        verifyRefreshToken(
          token
        );

      /*
       * Preserve your existing refresh-token behaviour.
       */
      const payload = {
        id: decoded.id,
        email: decoded.email,
        name: decoded.name,
      };

      const newToken =
        signToken(payload);

      const newRefreshToken =
        signRefreshToken(
          payload
        );

      applyRefreshToken(
        res,
        newRefreshToken
      );

      return res.json({
        token: newToken,
      });

    } catch {
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
  (req, res) => {
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

  (req, res) => {
    const refreshToken =
      signRefreshToken({
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
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