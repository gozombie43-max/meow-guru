// backend/auth/jwt.js
import jwt from 'jsonwebtoken';

const SECRET         = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET;

export const signToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: '15m' });

export const signRefreshToken = (payload) =>
  jwt.sign(payload, REFRESH_SECRET, { expiresIn: '365d' });

export const verifyToken = (token) =>
  jwt.verify(token, SECRET);

export const verifyRefreshToken = (token) =>
  jwt.verify(token, REFRESH_SECRET);