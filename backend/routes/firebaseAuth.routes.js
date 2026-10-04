import express from 'express';
import { protect } from '../middleware/protect.js';

const router = express.Router();

// The enclosing /auth router applies the existing authentication rate limiter.
router.post('/token', protect, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    // Firebase remains optional for app startup and all other Meow auth flows.
    const { firebaseAuth } = await import('../config/firebase.js');
    const uid = String(req.user.id);
    // Never accept an identity or additional Firebase claims from the client.
    const token = await firebaseAuth.createCustomToken(uid);
    res.json({ token, uid, projectId: process.env.FIREBASE_PROJECT_ID });
  } catch {
    res.status(503).json({ error: 'Firebase authentication is unavailable. Please retry shortly.' });
  }
});

export default router;
