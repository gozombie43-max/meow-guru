// backend/routes/accessCodes.js
import express from 'express';
import crypto from 'crypto';
import { getAccessCodesContainer } from '../containerStore.js';

const router = express.Router();

const isProd = process.env.NODE_ENV === 'production';

// Generate a session token
const generateSessionToken = () => crypto.randomBytes(32).toString('hex');

/**
 * POST /api/access-code/verify
 * Body: { code: "8481" }
 * Sets an HTTP-only cookie on success
 */
router.post('/verify', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ valid: false, error: 'Access code is required' });
    }

    const trimmed = code.trim();
    const container = getAccessCodesContainer();

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

    // Create a secure session token
    const sessionToken = generateSessionToken();

    // Set HTTP-only cookie
    res.cookie('access_session', sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
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
 * Returns whether the current session has a valid access cookie
 */
router.get('/check', (req, res) => {
  const session = req.cookies?.access_session;
  return res.json({ valid: !!session });
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
