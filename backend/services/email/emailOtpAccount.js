import { randomUUID } from 'node:crypto';
import { revokeUserSessions } from '../../auth/sessions.js';
import { findUserByEmail, insertRegisteredUser } from '../../repositories/authRegistrationRepository.js';
import { confirmOtpUserEmail } from '../../repositories/emailLoginOtpRepository.js';

/**
 * Finds or creates the account for a verified email code.
 * `passwordHash` (sign-up only) is stored on newly created accounts so the
 * user can later sign in with email + password. Existing accounts are never
 * modified here, so a code cannot be used to overwrite someone's password.
 */
export async function resolveEmailOtpAccount(email, name, passwordHash) {
  let user = await findUserByEmail(email);
  if (!user) {
    const now = new Date();
    const account = {
      id: `user-${randomUUID()}`, name: (typeof name === 'string' && name.trim().length >= 2 ? name.trim() : email.split('@')[0]).slice(0, 80), email,
      role: 'student', authProvider: 'local', emailVerified: true, emailVerifiedAt: now,
      ...(typeof passwordHash === 'string' && passwordHash ? { passwordHash } : {}),
      progress: {}, bookmarks: [], bookmarkEntries: [], recentQuizzes: [], createdAt: now.toISOString(),
    };
    try { await insertRegisteredUser(account); user = account; }
    catch (error) {
      // A concurrent password/Google registration may have claimed this address.
      if (error.code !== 11000) throw error;
      user = await findUserByEmail(email);
    }
  }
  if (!user || ['suspended', 'banned'].includes(user.status)) return null;
  if (user.emailVerified !== true) {
    const result = await confirmOtpUserEmail(user.id, email);
    if (result.matchedCount === 1) {
      await revokeUserSessions(user.id, 'unverified-account-claimed');
      delete user.passwordHash;
      user.emailVerified = true;
    } else {
      user = await findUserByEmail(email);
      if (!user || user.emailVerified !== true || ['suspended', 'banned'].includes(user.status)) {
        return null;
      }
    }
  }
  return user;
}
