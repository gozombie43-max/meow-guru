import { verifyToken } from '../auth/jwt.js';
import { assertSession } from '../auth/sessions.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = await assertSession(verifyToken(authHeader.slice(7)));
    return next();
  } catch (err) {
    if (!err.statusCode && !['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) return next(err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();
  try { req.user = await assertSession(verifyToken(authHeader.slice(7))); }
  catch (err) { if (!err.statusCode && !['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) return next(err); }
  return next();
};
