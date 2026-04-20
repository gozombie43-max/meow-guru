// backend/auth/jwt.js
import jwt from 'jsonwebtoken';

const SECRET         = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '30d';
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '365d';

export const signToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: ACCESS_TOKEN_TTL });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });

export const verifyToken = (token) =>
  jwt.verify(token, SECRET);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_SECRET);
