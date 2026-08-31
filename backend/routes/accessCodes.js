// backend/routes/accessCodes.js

import express from 'express';
import crypto from 'crypto';

import {
  getAccessCodesCollection,
} from '../config/mongodb.js';

import { validateBody } from '../middleware/validation.js';
import { accessCodeVerifySchema } from '../schemas/apiSchemas.js';

const router = express.Router();

const isProd =
  process.env.NODE_ENV === 'production';

const SESSION_SECRET =
  process.env.JWT_SECRET ||
  process.env.ADMIN_SECRET ||
  'access-session-secret-fallback';

/**
 * Creates:
 * "<timestamp>:<codeId>.<signature>"
 */
const createSignedSessionToken = (codeId) => {
  const payload =
    `${Date.now()}:${codeId}`;

  const sig = crypto
    .createHmac(
      'sha256',
      SESSION_SECRET
    )
    .update(payload)
    .digest('hex');

  return `${payload}.${sig}`;
};

/**
 * Verify signed access session.
 * Maximum validity: 24 hours.
 */
const verifySignedSessionToken = (token) => {
  if (
    !token ||
    typeof token !== 'string'
  ) {
    return false;
  }

  const parts = token.split('.');

  if (parts.length !== 2) {
    return false;
  }

  const [payload, sig] = parts;

  const expectedSig = crypto
    .createHmac(
      'sha256',
      SESSION_SECRET
    )
    .update(payload)
    .digest('hex');

  const a = Buffer.from(
    sig,
    'utf8'
  );

  const b = Buffer.from(
    expectedSig,
    'utf8'
  );

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return false;
  }

  const [timestampStr] =
    payload.split(':');

  const timestamp =
    parseInt(timestampStr, 10);

  if (
    !Number.isFinite(timestamp) ||
    Date.now() - timestamp >
      24 * 60 * 60 * 1000
  ) {
    return false;
  }

  return true;
};


// ── POST /api/access-code/verify ───────────────────────

router.post(
  '/verify',

  validateBody(
    accessCodeVerifySchema
  ),

  async (req, res) => {
    try {
      const { code } = req.body;

      const trimmed =
        String(code).trim();

      const collection =
        getAccessCodesCollection();

      /*
       * Find matching active access code.
       */
      const codeDoc =
        await collection.findOne({
          code: trimmed,
          active: true,
        });

      if (!codeDoc) {
        return res
          .status(401)
          .json({
            valid: false,
            error:
              'Invalid access code',
          });
      }


      // ── Expiry ─────────────────────────────────────────

      if (
        codeDoc.expiresAt &&
        new Date(codeDoc.expiresAt) <
          new Date()
      ) {
        return res
          .status(401)
          .json({
            valid: false,
            error:
              'This access code has expired',
          });
      }


      // ── Usage limit ────────────────────────────────────

      const currentUsed =
        Number(
          codeDoc.usedCount || 0
        );

      const maxUses =
        Number(
          codeDoc.maxUses || 0
        );

      if (
        maxUses > 0 &&
        currentUsed >= maxUses
      ) {
        return res
          .status(401)
          .json({
            valid: false,
            error:
              'This access code has reached its usage limit',
          });
      }


      /*
       * Increment usage atomically.
       *
       * If maxUses exists, include the current count
       * in the filter so two simultaneous requests
       * cannot both consume the final allowed use.
       */
      const usageFilter = {
        _id: codeDoc._id,
        active: true,
      };

      if (maxUses > 0) {
        usageFilter.usedCount =
          currentUsed;
      }

      const updateResult =
        await collection.updateOne(
          usageFilter,
          {
            $inc: {
              usedCount: 1,
            },
          }
        );

      if (
        updateResult.matchedCount === 0
      ) {
        return res
          .status(409)
          .json({
            valid: false,
            error:
              'Access code usage changed. Please try again.',
          });
      }


      // ── Session token ─────────────────────────────────

      const sessionToken =
        createSignedSessionToken(
          codeDoc.id
        );


      // ── HTTP-only cookie ──────────────────────────────

      res.cookie(
        'access_session',
        sessionToken,
        {
          httpOnly: true,
          secure: isProd,
          sameSite:
            isProd
              ? 'none'
              : 'lax',

          maxAge:
            24 *
            60 *
            60 *
            1000,

          path: '/',
        }
      );

      return res.json({
        valid: true,
      });

    } catch (err) {
      console.error(
        'Access code verification error:',
        err.message
      );

      return res
        .status(500)
        .json({
          valid: false,
          error: 'Server error',
        });
    }
  }
);


// ── GET /api/access-code/check ─────────────────────────

router.get(
  '/check',
  (req, res) => {
    const session =
      req.cookies?.access_session;

    const isValid =
      verifySignedSessionToken(
        session
      );

    return res.json({
      valid: isValid,
    });
  }
);


// ── POST /api/access-code/logout ───────────────────────

router.post(
  '/logout',
  (req, res) => {
    res.clearCookie(
      'access_session',
      {
        httpOnly: true,
        secure: isProd,
        sameSite:
          isProd
            ? 'none'
            : 'lax',
        path: '/',
      }
    );

    return res.json({
      ok: true,
    });
  }
);

export default router;