// backend/auth/jwt.js
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';

const SECRET         = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_TTL  = process.env.ACCESS_TOKEN_TTL  || '1h';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '30d';

// In-memory blacklist — adequate for single-instance Azure Free tier.
// Replace with Redis if you scale to multiple instances.
const blacklist = new Set();

export const signToken = (payload) =>
  jwt.sign({ ...payload, jti: randomUUID() }, SECRET, { expiresIn: ACCESS_TOKEN_TTL });

export const signRefreshToken = (payload) =>
  jwt.sign({ ...payload, jti: randomUUID() }, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

export const verifyToken = (token) =>
  jwt.verify(token, SECRET);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_SECRET);

export const revokeToken = (jti) => blacklist.add(jti);
export const isRevoked  = (jti) => blacklist.has(jti);
