// backend/auth/jwt.js
// @ts-check
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { validateEnvironment } from '../config/environment.js';

const { JWT_SECRET: SECRET, REFRESH_TOKEN_SECRET: REFRESH_SECRET } = validateEnvironment();
/** @param {string} value @returns {NonNullable<import('jsonwebtoken').SignOptions['expiresIn']>} */
function tokenLifetime(value) {
  if (!/^\d+(?:s|m|h|d)$/.test(value)) throw new Error('Token lifetime must be a duration such as 1h or 30d');
  return /** @type {NonNullable<import('jsonwebtoken').SignOptions['expiresIn']>} */ (value);
}
const ACCESS_TOKEN_TTL = tokenLifetime(process.env.ACCESS_TOKEN_TTL || '1h');
const REFRESH_TOKEN_TTL = tokenLifetime(process.env.REFRESH_TOKEN_TTL || '30d');



/** @param {Record<string, unknown>} payload */
export const signToken = (payload) =>
  jwt.sign({ ...payload, type: 'access', jti: randomUUID() }, SECRET, { expiresIn: ACCESS_TOKEN_TTL });

/** @param {Record<string, unknown>} payload */
export const signRefreshToken = (payload) =>
  jwt.sign({ ...payload, type: 'refresh', jti: randomUUID() }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

/** @param {string} token @param {string} secret */
function verifyClaims(token, secret) {
  const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
  if (typeof decoded === 'string') throw new Error('Invalid token payload');
  return decoded;
}

/** @param {string} token */
export const verifyToken = (token) => {
  const decoded = verifyClaims(token, SECRET);
  if (decoded.type && decoded.type !== 'access') throw Object.assign(new Error('Invalid access token purpose'), { statusCode: 401 });
  return decoded;
};

/** @param {string} token */
export const verifyRefreshToken = (token) => {
  const decoded = verifyClaims(token, REFRESH_SECRET);
  if (decoded.type !== 'refresh') throw Object.assign(new Error('Invalid refresh token purpose'), { statusCode: 401 });
  return decoded;
};

// Temporary compatibility verifier for refresh tokens issued before session
// records and explicit token-purpose claims were introduced. Keep this out of
// ordinary authentication paths; rotateSession is the only caller.
/** @param {string} token */
export const verifyLegacyRefreshToken = (token) => {
  const decoded = verifyClaims(token, REFRESH_SECRET);
  if (decoded.type !== undefined || decoded.sid !== undefined || !decoded.id || !decoded.jti) {
    throw Object.assign(new Error('Invalid legacy refresh token'), { statusCode: 401 });
  }
  return decoded;
};

// Reconstruct the current refresh cookie for concurrent refresh retries without
// storing bearer credentials in the database.
/** @param {{ userId: string, _id: string, refreshJti: string, refreshIssuedAt: number, expiresAt: Date }} session */
export const signSessionRefreshToken = (session) => jwt.sign({
  id: session.userId, sid: session._id, type: 'refresh', jti: session.refreshJti,
  iat: session.refreshIssuedAt, exp: Math.floor(session.expiresAt.getTime() / 1000),
}, REFRESH_SECRET, { algorithm: 'HS256' });


/** @param {Record<string, unknown>} payload */
export const signBattleRematchToken = (payload) =>
  jwt.sign(
    {
      ...payload,
      type: "battle-rematch",
    },
    SECRET,
    {
      expiresIn: "10m",
      jwtid: randomUUID(),
    }
  );

/** @param {string} token */
export const verifyBattleRematchToken = (token) => {
  const decoded = verifyClaims(token, SECRET);

  if (decoded.type !== "battle-rematch") {
    throw new Error("Invalid rematch token");
  }

  return decoded;
};

