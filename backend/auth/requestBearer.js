// backend/auth/requestBearer.js
// @ts-check
import { verifyToken } from './jwt.js';

const VERIFIED_BEARER_CACHE = Symbol('meow.verifiedBearer');

/**
 * Verify a request's Bearer token once per unique Authorization header value so
 * rate limiters and route auth middleware never repeat synchronous jwt.verify().
 * @param {any} req
 * @returns {import('jsonwebtoken').JwtPayload | null}
 */
export const getVerifiedBearerToken = (req) => {
  const authHeader = req?.headers?.authorization;
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return null;
  const cached = req[VERIFIED_BEARER_CACHE];
  if (cached && cached.rawHeader === authHeader) {
    if (cached.error) throw cached.error;
    return cached.decoded;
  }
  try {
    const decoded = verifyToken(authHeader.slice(7).trim());
    req[VERIFIED_BEARER_CACHE] = { rawHeader: authHeader, decoded, error: null };
    return decoded;
  } catch (error) {
    req[VERIFIED_BEARER_CACHE] = { rawHeader: authHeader, decoded: null, error };
    throw error;
  }
};

/**
 * Non-throwing wrapper for rate limiters that fall back to client IP keying.
 * @param {any} req
 * @returns {import('jsonwebtoken').JwtPayload | null}
 */
export const tryGetVerifiedBearerToken = (req) => {
  try {
    return getVerifiedBearerToken(req);
  } catch {
    return null;
  }
};
