// backend/auth/jwt.js
import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;

export const signToken = (payload) =>
  jwt.sign(payload, SECRET, { expiresIn: '7d' });

export const verifyToken = (token) =>
  jwt.verify(token, SECRET);