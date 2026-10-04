// Reuse the same allowlist for CORS and cookie-authenticated mutations.
// @ts-check
import { isLocalEnvironment } from '../config/environment.js';
/** @param {unknown} origin */
export function isTrustedOrigin(origin) {
  if (typeof origin !== 'string' || origin === 'null') return false;
  const configured = [process.env.FRONTEND_URL, ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')]
    .flatMap(value => value ? [value.trim().replace(/\/$/, '')] : []);
  if (configured.includes(origin)) return true;
  return isLocalEnvironment() && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
}

/** @type {import('express').RequestHandler} */
export function requireTrustedOrigin(req, res, next) {
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch { /* Reject malformed referrers. */ }
  }
  if (!isTrustedOrigin(origin)) return res.status(403).json({ error: 'Untrusted request origin' });
  next();
}
