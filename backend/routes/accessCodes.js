// backend/routes/accessCodes.js
import express from 'express';
import crypto from 'crypto';
import { getAccessCodesContainer } from '../containerStore.js';
import { validateBody } from '../middleware/validation.js';
import { accessCodeVerifySchema } from '../schemas/apiSchemas.js';

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';
const SESSION_SECRET = process.env.JWT_SECRET || process.env.ADMIN_SECRET || 'access-session-secret-fallback';

/**
 * Creates an HMAC signed session token: "<timestamp>:<codeId>.<signature>"
 */
const createSignedSessionToken = (codeId) => {
  const payload = `${Date.now()}:${codeId}`;
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
};

/**
 * Verifies HMAC signed session token and checks max validity (24 hours).
 */
const verifySignedSessionToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('hex');

  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return false;
  }

  const [timestampStr] = payload.split(':');
  const timestamp = parseInt(timestampStr, 10);
  if (!Number.isFinite(timestamp) || Date.now() - timestamp > 24 * 60 * 60 * 1000) {
    return false;
  }

  return true;
};

/**
 * POST /api/access-code/verify
 * Body: { code: "8481" }
 * Sets an HTTP-only signed cookie on success
 */
router.post('/verify', validateBody(accessCodeVerifySchema), async (req, res) => {
  try {
    const { code } = req.body;
    const trimmed = code.trim();
    const container = getAccessCodesContainer();
    if (!container) {
      return res.status(503).json({ valid: false, error: 'Database not initialized' });
    }

    // Query for matching active code
    const { resources } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.code = @code AND c.active = true',
        parameters: [{ name: '@code', value: trimmed }],
      })
      .fetchAll();

    if (resources.length === 0) {
      return res.status(401).json({ valid: false, error: 'Invalid access code' });
    }

    const codeDoc = resources[0];

    // Check expiry
    if (codeDoc.expiresAt && new Date(codeDoc.expiresAt) < new Date()) {
      return res.status(401).json({ valid: false, error: 'This access code has expired' });
    }

    // Check max uses
    if (codeDoc.maxUses && codeDoc.usedCount >= codeDoc.maxUses) {
      return res.status(401).json({ valid: false, error: 'This access code has reached its usage limit' });
    }

    // Increment usage count
    codeDoc.usedCount = (codeDoc.usedCount || 0) + 1;
    await container.item(codeDoc.id, codeDoc.code).replace(codeDoc);

    // Create a cryptographically signed session token
    const sessionToken = createSignedSessionToken(codeDoc.id);

    // Set HTTP-only cookie
    res.cookie('access_session', sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/',
    });

    return res.json({ valid: true });
  } catch (err) {
    console.error('Access code verification error:', err.message);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
});

/**
 * GET /api/access-code/check
 * Returns whether the current session has a cryptographically valid access cookie
 */
router.get('/check', (req, res) => {
  const session = req.cookies?.access_session;
  const isValid = verifySignedSessionToken(session);
  return res.json({ valid: isValid });
});

/**
 * POST /api/access-code/logout
 * Clears the access session cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('access_session', {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
  });
  return res.json({ ok: true });
});

export default router;

