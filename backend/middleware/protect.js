import { getVerifiedBearerToken } from '../auth/requestBearer.js';
import { assertSession } from '../auth/sessions.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = getVerifiedBearerToken(req);
    if (!decoded) return res.status(401).json({ error: 'No token provided' });
    req.user = await assertSession(decoded);
    return next();
  } catch (err) {
    if (!err.statusCode && !['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) return next(err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try {
    const decoded = getVerifiedBearerToken(req);
    if (decoded) req.user = await assertSession(decoded);
  } catch (err) {
    if (!err.statusCode && !['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) return next(err);
  }
  return next();
};
