// backend/middleware/protect.js
import { verifyToken } from '../auth/jwt.js';
import { isRevoked } from '../auth/jwt.js';
import { assertSession } from '../auth/sessions.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = verifyToken(token);
    if (decoded.jti && isRevoked(decoded.jti)) {
      return res.status(401).json({ error: 'Token has been revoked' });
    }
    req.user = await assertSession(decoded);
    next();
  } catch (err) {
    if (!err.statusCode && !['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(err.name)) return next(err);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};
