import { describe, it, expect } from 'vitest';
import {
  signToken,
  signRefreshToken,
  verifyToken,
  verifyRefreshToken,
  revokeToken,
  isRevoked,
} from '../jwt.js';

describe('Auth JWT Module', () => {
  it('signs and verifies an access token correctly', () => {
    const payload = { userId: 'u_123', email: 'user@example.com', role: 'student' };
    const token = signToken(payload);

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);

    const decoded = verifyToken(token);
    expect(decoded.userId).toBe('u_123');
    expect(decoded.email).toBe('user@example.com');
    expect(decoded.role).toBe('student');
    expect(decoded.jti).toBeDefined();
  });

  it('signs and verifies a refresh token correctly', () => {
    const payload = { userId: 'u_123' };
    const refreshToken = signRefreshToken(payload);

    expect(typeof refreshToken).toBe('string');
    const decoded = verifyRefreshToken(refreshToken);
    expect(decoded.userId).toBe('u_123');
    expect(decoded.jti).toBeDefined();
  });

  it('correctly tracks and checks blacklisted token JTIs', () => {
    const sampleJti = 'test-token-uuid-12345';
    expect(isRevoked(sampleJti)).toBe(false);

    revokeToken(sampleJti);
    expect(isRevoked(sampleJti)).toBe(true);
  });

  it('throws error when verifying an invalid token string', () => {
    expect(() => verifyToken('invalid.token.payload')).toThrow();
  });
});
