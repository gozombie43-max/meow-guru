import express from 'express';

import { protect } from '../middleware/protect.js';

import {
  createConvexToken,
  getConvexJwks,
  CONVEX_TOKEN_TTL_SECONDS,
} from '../auth/convexJwt.js';

const router = express.Router();

/**
 * Public verification keys for Convex.
 *
 * This endpoint exposes public keys only.
 */
router.get('/.well-known/jwks.json', (req, res, next) => {
  try {
    res.set(
      'Cache-Control',
      'public, max-age=300, stale-while-revalidate=600'
    );

    return res.json(getConvexJwks());
  } catch (error) {
    return next(error);
  }
});

/**
 * Issue a short-lived Convex-specific JWT.
 *
 * Requires an existing, valid Meow access token
 * and an active MongoDB-backed session.
 */
router.post('/token', protect, (req, res, next) => {
  try {
    const token = createConvexToken(req.user);

    res.set('Cache-Control', 'no-store, private');

    return res.json({
      token,
      tokenType: 'Bearer',
      expiresIn: CONVEX_TOKEN_TTL_SECONDS,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
