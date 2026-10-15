import { expect, it, vi } from 'vitest';
import { createPasswordResetToken, hashPasswordResetToken } from '../passwordReset.js';

it('generates distinct 256-bit tokens, SHA-256 hashes, and a 15-minute expiry', () => {
  vi.useFakeTimers();
  try {
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    const first = createPasswordResetToken(), second = createPasswordResetToken();
    expect(first.token).toMatch(/^[a-f0-9]{64}$/);
    expect(first.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).not.toBe(first.token);
    expect(first.tokenHash).toBe(hashPasswordResetToken(first.token));
    expect(first.expiresAt).toEqual(new Date('2026-10-15T12:15:00Z'));
  } finally { vi.useRealTimers(); }
});
