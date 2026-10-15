import { getUsersCollection, getMongoDB } from '../config/mongodb.js';
export const normalizeAccountEmail = email => String(email || '').trim().toLowerCase();
export const authUserProjection = { id: 1, name: 1, email: 1, emailNormalized: 1, passwordHash: 1, authProvider: 1, googleId: 1, avatar: 1, role: 1, status: 1, emailVerified: 1, emailVerifiedAt: 1 };
export async function findUserByEmail(email) {
  const normalized = normalizeAccountEmail(email);
  const rows = await getUsersCollection().find({
    $or: [{ emailNormalized: normalized }, { email: normalized, emailNormalized: { $exists: false } }],
    type: { $ne: 'email_lock' },
  }, { projection: authUserProjection }).limit(2).toArray();
  if (rows.length > 1) throw Object.assign(new Error('Account identity needs review'), { statusCode: 409, code: 'ACCOUNT_IDENTITY_CONFLICT' });
  return rows[0] || null;
}
export function acquireRegistrationLock(email) {
  return getMongoDB().collection('registrationLocks').insertOne({ _id: email, createdAt: new Date() });
}
export function releaseRegistrationLock(email) {
  return getMongoDB().collection('registrationLocks').deleteOne({ _id: email });
}
export function insertRegisteredUser(user) { return getUsersCollection().insertOne({ ...user, accountRecord: true, historyStorageVersion: 1, emailNormalized: normalizeAccountEmail(user.email) }); }

export function verifyLocalUserEmailByTokenHash(tokenHash, now = new Date()) {
  return getUsersCollection().updateOne(
    {
      authProvider: 'local',
      emailVerified: { $ne: true },
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: now },
    },
    {
      $set: { emailVerified: true, emailVerifiedAt: now },
      $unset: { emailVerificationTokenHash: '', emailVerificationExpiresAt: '' },
    }
  );
}

export function replaceEmailVerificationToken({ email, tokenHash, expiresAt, now = new Date() }) {
  return getUsersCollection().findOneAndUpdate(
    {
      emailNormalized: normalizeAccountEmail(email),
      authProvider: 'local',
      emailVerified: { $ne: true },
      $or: [
        { emailVerificationLastSentAt: { $exists: false } },
        { emailVerificationLastSentAt: { $lte: new Date(now.getTime() - 60_000) } },
      ],
    },
    {
      $set: {
        emailVerificationTokenHash: tokenHash,
        emailVerificationExpiresAt: expiresAt,
        emailVerificationLastSentAt: now,
      },
    },
    { returnDocument: 'after', projection: { _id: 0, id: 1, name: 1, email: 1 } }
  );
}

export function issuePasswordResetToken({ email, tokenHash, expiresAt, now = new Date() }) {
  return getUsersCollection().findOneAndUpdate(
    {
      emailNormalized: normalizeAccountEmail(email),
      authProvider: 'local',
      $or: [
        { passwordResetLastSentAt: { $exists: false } },
        { passwordResetLastSentAt: { $lte: new Date(now.getTime() - 60_000) } },
      ],
    },
    { $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt, passwordResetLastSentAt: now } },
    { returnDocument: 'after', projection: { _id: 0, id: 1, email: 1 } }
  );
}

export function consumePasswordResetToken({ tokenHash, passwordHash, now = new Date() }) {
  return getUsersCollection().findOneAndUpdate(
    { authProvider: 'local', passwordResetTokenHash: tokenHash, passwordResetExpiresAt: { $gt: now } },
    {
      $set: { passwordHash, passwordChangedAt: now },
      $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '', passwordResetLastSentAt: '' },
    },
    { returnDocument: 'after', projection: { _id: 0, id: 1, email: 1 } }
  );
}
