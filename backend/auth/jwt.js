// backend/auth/jwt.js
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { LRUCache } from 'lru-cache';

const SECRET         = process.env.JWT_SECRET || 'dev-fallback-secret-key-change-in-prod';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'dev-fallback-refresh-secret-key-change-in-prod';
const ACCESS_TOKEN_TTL  = process.env.ACCESS_TOKEN_TTL  || '1h';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '30d';

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || !process.env.REFRESH_TOKEN_SECRET)) {
  throw new Error('JWT_SECRET and REFRESH_TOKEN_SECRET are required in production');
}

// TTL-managed LRU cache for blacklisted tokens (prevents unbounded memory growth)
const blacklist = new LRUCache({
  max: 10000,
  ttl: 30 * 24 * 60 * 60 * 1000, // 30 days matches max refresh token TTL
});

export const signToken = (payload) =>
  jwt.sign({ ...payload, jti: randomUUID() }, SECRET, { expiresIn: ACCESS_TOKEN_TTL });

export const signRefreshToken = (payload) =>
  jwt.sign({ ...payload, jti: randomUUID() }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

export const verifyToken = (token) =>
  jwt.verify(token, SECRET);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_SECRET);

export const revokeToken = (jti) => blacklist.set(jti, true);
export const isRevoked  = (jti) => blacklist.has(jti);

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

export const verifyBattleRematchToken = (token) => {
  const decoded = jwt.verify(token, SECRET);

  if (decoded.type !== "battle-rematch") {
    throw new Error("Invalid rematch token");
  }

  return decoded;
};

