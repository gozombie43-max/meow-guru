import { ensureRegistrationLockExpiry } from './registrationLockExpiry.js';

export const id = '021-auth-email-security';

export async function up(db) {
  const users = db.collection('users');
  await users.createIndex(
    { emailVerificationTokenHash: 1, emailVerificationExpiresAt: 1 },
    {
      name: 'email_verification_token_lookup',
      partialFilterExpression: { emailVerificationTokenHash: { $type: 'string' } },
    }
  );
  await users.createIndex(
    { passwordResetTokenHash: 1, passwordResetExpiresAt: 1 },
    {
      name: 'password_reset_token_lookup',
      partialFilterExpression: { passwordResetTokenHash: { $type: 'string' } },
    }
  );
  // Only disposable lock documents expire; never put a token TTL on users.
  await ensureRegistrationLockExpiry(db);
}
