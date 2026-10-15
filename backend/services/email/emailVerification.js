import crypto from 'node:crypto';

const VERIFICATION_TTL_MS = 30 * 60 * 1000; // 30 minutes

export function createEmailVerificationToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');

  return {
    token, // Send this to the user.
    tokenHash, // Store only this in MongoDB.
    expiresAt: new Date(Date.now() + VERIFICATION_TTL_MS),
  };
}

export function hashEmailVerificationToken(token) {
  return crypto
    .createHash('sha256')
    .update(String(token))
    .digest('hex');
}
