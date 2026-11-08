import { randomUUID } from 'node:crypto';
import { revokeUserSessions } from '../../auth/sessions.js';
import { findUserByEmail, insertRegisteredUser } from '../../repositories/authRegistrationRepository.js';
import { confirmOtpUserEmail } from '../../repositories/emailLoginOtpRepository.js';

export async function resolveEmailOtpAccount(email) {
  let user = await findUserByEmail(email);
  if (!user) {
    const now = new Date();
    const account = {
      id: `user-${randomUUID()}`, name: email.split('@')[0].slice(0, 80), email,
      role: 'student', authProvider: 'local', emailVerified: true, emailVerifiedAt: now,
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
