import { createHmac, randomBytes, randomInt } from 'node:crypto';

export const EMAIL_OTP_TTL_MS = 5 * 60 * 1000;
export const EMAIL_OTP_COOLDOWN_MS = 60 * 1000;
export const EMAIL_OTP_WINDOW_MS = 60 * 60 * 1000;
export const EMAIL_OTP_MAX_REQUESTS = 5;
export const EMAIL_OTP_MAX_ATTEMPTS = 5;

export function hashEmailLoginCode(email, challengeId, code) {
  // Six-digit codes need a keyed hash to resist offline guessing after a DB leak.
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('Email sign-in requires a configured JWT_SECRET');
  return createHmac('sha256', secret)
    .update(JSON.stringify(['meow:email-login:v1', email, challengeId, code]))
    .digest('hex');
}

export function createEmailLoginOtp(email, now = new Date()) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const challengeId = randomBytes(32).toString('hex');
  return {
    code, challengeId, codeHash: hashEmailLoginCode(email, challengeId, code),
    expiresAt: new Date(now.getTime() + EMAIL_OTP_TTL_MS),
  };
}
