import { describe, it, expect } from 'vitest';
import {
  signToken,
  signRefreshToken,
  verifyToken,
  verifyRefreshToken,
  revokeToken,
  isRevoked,
  signBattleRematchToken,
  verifyBattleRematchToken,
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

  it('signs and verifies a battle rematch token correctly', () => {
    const payload = {
      requesterUserId: 'user_1',
      opponentUserId: 'user_2',
      opponentName: 'Player 2',
      subject: 'mathematics',
      topic: 'percentages',
      questionCount: 10,
    };
    const token = signBattleRematchToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyBattleRematchToken(token);
    expect(() => verifyToken(token)).toThrow('Invalid access token purpose');
    expect(decoded.type).toBe('battle-rematch');
    expect(decoded.requesterUserId).toBe('user_1');
    expect(decoded.opponentUserId).toBe('user_2');
    expect(decoded.opponentName).toBe('Player 2');
    expect(decoded.subject).toBe('mathematics');

    // Normal token should fail rematch verification
    const normalToken = signToken({ id: 'user_1' });
    expect(() => verifyBattleRematchToken(normalToken)).toThrow('Invalid rematch token');
  });
});
