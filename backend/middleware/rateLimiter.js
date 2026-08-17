// middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

/**
 * Global baseline limiter — generous enough for normal traffic,
 * tight enough to stop runaway clients.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

/**
 * Tighter limiter for authentication endpoints —
 * prevents brute-force on login/register.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
});

/**
 * Strict limiter for AI routes —
 * tutor-chat runs Sharp + Tesseract + Azure OpenAI vision per request.
 */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit reached, please try again later.' },
});

/**
 * Moderate limiter for upload/bulk-insert routes.
 */
export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Upload rate limit reached, please try again later.' },
});
