import { runtimeLog } from '../infrastructure/runtimeLog.js';
// backend/routes/accessCodes.js

import express from 'express';
import crypto from 'crypto';

import * as accessCodeRepo from '../repositories/accessCodeRepository.js';

import { validateBody } from '../middleware/validation.js';
import { accessCodeVerifySchema } from '../schemas/apiSchemas.js';
import { isTrustedOrigin } from '../auth/requestOrigin.js';

function verifyBrowserOrigin(req, res, next) {
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try {
      origin = new URL(req.headers.referer).origin;
    } catch {
      return res.status(403).json({ valid: false, error: 'Untrusted request origin' });
    }
  }
  if (origin || req.headers['sec-fetch-site'] === 'cross-site') {
    if (!isTrustedOrigin(origin)) {
      return res.status(403).json({ valid: false, error: 'Untrusted request origin' });
    }
  }
  return next();
}

const { findActiveAccessCode, consumeAccessCode } = accessCodeRepo;

const getAccessCodeLockoutState = (...args) =>
  'getAccessCodeLockoutState' in accessCodeRepo && typeof accessCodeRepo.getAccessCodeLockoutState === 'function'
    ? Promise.resolve(accessCodeRepo.getAccessCodeLockoutState(...args))
    : Promise.resolve({ locked: false, attempts: 0, retryAfterSeconds: 0 });

const recordAccessCodeFailure = (...args) =>
  'recordAccessCodeFailure' in accessCodeRepo && typeof accessCodeRepo.recordAccessCodeFailure === 'function'
    ? Promise.resolve(accessCodeRepo.recordAccessCodeFailure(...args))
    : Promise.resolve({ locked: false, attempts: 1, retryAfterSeconds: 0 });

const clearAccessCodeFailures = (...args) =>
  'clearAccessCodeFailures' in accessCodeRepo && typeof accessCodeRepo.clearAccessCodeFailures === 'function'
    ? Promise.resolve(accessCodeRepo.clearAccessCodeFailures(...args))
    : Promise.resolve();

function resolveAccessClientKey(req) {
  const rawIp = String(req.ip || req.socket?.remoteAddress || 'unknown').trim();
  return rawIp.replace(/^::ffff:/, '') || 'unknown';
}

const router = express.Router();

const isProd =
  process.env.NODE_ENV === 'production';

/**
 * Resolve isolated access session secret.
 * Never fall back to JWT_SECRET, ADMIN_SECRET, or hardcoded strings.
 */
export const getSessionSecret = () => {
  const secret = process.env.SESSION_SECRET || process.env.ACCESS_CODE_SECRET;
  if (!secret) {
    return undefined;
  }
  if (process.env.JWT_SECRET && secret === process.env.JWT_SECRET) {
    // Strict key isolation: disallow JWT_SECRET reuse as access session secret
    return undefined;
  }
  return secret;
};

/**
 * Creates:
 * "<timestamp>:<codeId>.<signature>"
 */
export const createSignedSessionToken = (codeId) => {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('SESSION_SECRET or ACCESS_CODE_SECRET must be configured');
  }

  const payload =
    `${Date.now()}:${codeId}`;

  const sig = crypto
    .createHmac(
      'sha256',
      secret
    )
    .update(payload)
    .digest('hex');

  return `${payload}.${sig}`;
};

/**
 * Verify signed access session.
 * Maximum validity: 24 hours (with 5-minute clock drift tolerance).
 */
export const verifySignedSessionToken = (token) => {
  const secret = getSessionSecret();
  if (!secret) {
    return false;
  }

  if (
    !token ||
    typeof token !== 'string'
  ) {
    return false;
  }

  let rawToken = token;
  if (token.includes('%')) {
    try {
      rawToken = decodeURIComponent(token);
    } catch {
      return false;
    }
  }
  const parts = rawToken.split('.');

  if (parts.length !== 2) {
    return false;
  }

  const [payload, sig] = parts;
  if (!payload || !sig || sig.length !== 64 || !/^[0-9a-f]{64}$/i.test(sig)) {
    return false;
  }

  const colonIdx = payload.indexOf(':');
  if (colonIdx <= 0 || colonIdx === payload.length - 1) {
    return false;
  }

  const timestampStr = payload.slice(0, colonIdx);
  const timestamp =
    parseInt(timestampStr, 10);

  if (!Number.isFinite(timestamp)) {
    return false;
  }

  const now = Date.now();
  if (
    now - timestamp > 24 * 60 * 60 * 1000 ||
    timestamp - now > 5 * 60 * 1000
  ) {
    return false;
  }

  const expectedSig = crypto
    .createHmac(
      'sha256',
      secret
    )
    .update(payload)
    .digest('hex');

  const a = Buffer.from(
    sig.toLowerCase(),
    'utf8'
  );

  const b = Buffer.from(
    expectedSig.toLowerCase(),
    'utf8'
  );

  if (
    a.length !== b.length ||
    !crypto.timingSafeEqual(a, b)
  ) {
    return false;
  }

  return true;
};



// ── POST /api/access-code/verify ───────────────────────

router.post(
  '/verify',
  verifyBrowserOrigin,

  validateBody(
    accessCodeVerifySchema
  ),

  async (req, res) => {
    try {
      const clientKey = resolveAccessClientKey(req);
      const lockoutState = await getAccessCodeLockoutState(clientKey);
      if (lockoutState.locked) {
        if (lockoutState.retryAfterSeconds) {
          res.set('Retry-After', String(lockoutState.retryAfterSeconds));
        }
        return res.status(429).json({
          valid: false,
          error: 'Too many failed access code attempts. Please try again later.',
        });
      }

      const { code } = req.body;

      const trimmed =
        String(code).trim();



      /*
       * Find matching active access code.
       */
      const codeDoc =
        await findActiveAccessCode(trimmed);

      if (!codeDoc) {
        await recordAccessCodeFailure(clientKey);
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
        await recordAccessCodeFailure(clientKey);
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
        await recordAccessCodeFailure(clientKey);
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




      const updateResult =
        await consumeAccessCode(codeDoc._id, currentUsed, maxUses);

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

      await clearAccessCodeFailures(clientKey);

      // ── Session token ─────────────────────────────────

      const codeId = String(codeDoc.id || codeDoc._id || 'access');
      const sessionToken =
        createSignedSessionToken(
          codeId
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
        token: sessionToken,
      });

    } catch (err) {
      runtimeLog.error(
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
  verifyBrowserOrigin,
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
