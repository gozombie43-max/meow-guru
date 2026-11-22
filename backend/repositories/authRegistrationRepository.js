import { getUsersCollection, getMongoDB } from '../config/mongodb.js';
export const normalizeAccountEmail = email => String(email || '').trim().toLowerCase();
export const authUserProjection = { id: 1, name: 1, email: 1, emailNormalized: 1, passwordHash: 1, authProvider: 1, googleId: 1, avatar: 1, role: 1, status: 1, emailVerified: 1, emailVerifiedAt: 1 };
export async function findUserByEmail(email) {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return null;
  const users = getUsersCollection();
  const rows = await users.find(
    {
      accountRecord: true,
      emailNormalized: { $eq: normalized, $type: 'string' },
      type: { $ne: 'email_lock' },
    },
    { projection: authUserProjection },
  ).limit(2).toArray();
  if (rows.length > 1) {
    throw Object.assign(new Error('Account identity needs review'), { statusCode: 409, code: 'ACCOUNT_IDENTITY_CONFLICT' });
  }
  if (rows.length === 1) return rows[0];

  // Safe fallback for legacy un-backfilled accounts or test fixtures omitting `accountRecord: true`.
  // Queries indexed `email` (`email_1`) instead of unindexed `emailNormalized` to guarantee IXSCAN (zero COLLSCAN).
  const fallbackRows = await users.find(
    {
      email: normalized,
      type: { $ne: 'email_lock' },
    },
    { projection: authUserProjection },
  ).limit(2).toArray();
  if (fallbackRows.length > 1) {
    throw Object.assign(new Error('Account identity needs review'), { statusCode: 409, code: 'ACCOUNT_IDENTITY_CONFLICT' });
  }
  return fallbackRows[0] || null;
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
      emailVerificationTokenHash: { $eq: tokenHash, $type: 'string' },
      emailVerificationExpiresAt: { $gt: now },
      type: { $ne: 'email_lock' },
    },
    {
      $set: { emailVerified: true, emailVerifiedAt: now },
      $unset: { emailVerificationTokenHash: '', emailVerificationExpiresAt: '' },
    },
  );
}

export async function replaceEmailVerificationToken({ email, tokenHash, expiresAt, now = new Date() }) {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return null;
  const users = getUsersCollection();
  const baseFilter = {
    authProvider: 'local',
    emailVerified: { $ne: true },
    type: { $ne: 'email_lock' },
    $or: [
      { emailVerificationLastSentAt: { $exists: false } },
      { emailVerificationLastSentAt: { $lte: new Date(now.getTime() - 60_000) } },
    ],
  };
  const update = {
    $set: {
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationLastSentAt: now,
    },
  };
  const options = { returnDocument: 'after', projection: { _id: 0, id: 1, name: 1, email: 1 } };

  const updated = await users.findOneAndUpdate(
    {
      accountRecord: true,
      emailNormalized: { $eq: normalized, $type: 'string' },
      ...baseFilter,
    },
    update,
    options,
  );
  if (updated) return updated;

  return users.findOneAndUpdate(
    {
      accountRecord: { $ne: true },
      email: normalized,
      ...baseFilter,
    },
    update,
    options,
  );
}

export async function issuePasswordResetToken({ email, tokenHash, expiresAt, now = new Date() }) {
  const normalized = normalizeAccountEmail(email);
  if (!normalized) return null;
  const users = getUsersCollection();
  const baseFilter = {
    authProvider: 'local',
    type: { $ne: 'email_lock' },
    $or: [
      { passwordResetLastSentAt: { $exists: false } },
      { passwordResetLastSentAt: { $lte: new Date(now.getTime() - 60_000) } },
    ],
  };
  const update = {
    $set: { passwordResetTokenHash: tokenHash, passwordResetExpiresAt: expiresAt, passwordResetLastSentAt: now },
  };
  const options = { returnDocument: 'after', projection: { _id: 0, id: 1, email: 1 } };

  const updated = await users.findOneAndUpdate(
    {
      accountRecord: true,
      emailNormalized: { $eq: normalized, $type: 'string' },
      ...baseFilter,
    },
    update,
    options,
  );
  if (updated) return updated;

  return users.findOneAndUpdate(
    {
      accountRecord: { $ne: true },
      email: normalized,
      ...baseFilter,
    },
    update,
    options,
  );
}

export function consumeAccountRecoveryToken({ tokenHash, passwordHash, now = new Date() }) {
  return getUsersCollection().findOneAndUpdate(
    {
      authProvider: 'local',
      passwordResetTokenHash: { $eq: tokenHash, $type: 'string' },
      passwordResetExpiresAt: { $gt: now },
      type: { $ne: 'email_lock' },
    },
    {
      $set: { passwordHash, passwordChangedAt: now },
      $unset: { passwordResetTokenHash: '', passwordResetExpiresAt: '', passwordResetLastSentAt: '' },
    },
    { returnDocument: 'after', projection: { _id: 0, id: 1, email: 1 } },
  );
}

export { consumeAccountRecoveryToken as consumePasswordResetToken };
