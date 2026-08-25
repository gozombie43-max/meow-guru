// middleware/rateLimiter.js
import rateLimit from 'express-rate-limit';

/**
 * Key generator: prefer authenticated userId so limits are per-user,
 * not per-IP (which breaks behind Azure's shared proxy).
 */
const userKeyGenerator = (req) =>
  req.user?.id || req.user?._id || req.cookies?.userId || req.ip;

/**
 * Global baseline limiter — generous enough for normal traffic,
 * tight enough to stop runaway clients.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
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
 * Strict limiter for AI tutor routes (vision + OCR + LLM per request).
 * Max 20 AI calls per user per 15 min to protect Azure OpenAI quota.
 */
export const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: { error: 'AI rate limit reached, please try again later.' },
});

/**
 * Limiter for agent routes (cognitive mapper, adaptive quiz) —
 * each request may fire multiple LLM calls, so keep tight.
 * Max 30 calls per user per 15 min.
 */
export const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userKeyGenerator,
  message: { error: 'Agent rate limit reached, please try again later.' },
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
