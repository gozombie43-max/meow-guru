// Reuse the same allowlist for CORS and cookie-authenticated mutations.
export function isTrustedOrigin(origin) {
  if (typeof origin !== 'string' || origin === 'null') return false;
  const configured = [process.env.FRONTEND_URL, ...(process.env.CORS_ALLOWED_ORIGINS || '').split(',')]
    .filter(Boolean).map(value => value.trim().replace(/\/$/, ''));
  if (configured.includes(origin)) return true;
  return process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
}

export function requireTrustedOrigin(req, res, next) {
  let origin = req.headers.origin;
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch { /* Reject malformed referrers. */ }
  }
  if (!isTrustedOrigin(origin)) return res.status(403).json({ error: 'Untrusted request origin' });
  next();
}
