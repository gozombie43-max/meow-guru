import { getMongoDB, getUsersCollection } from '../config/mongodb.js';
import { EMAIL_OTP_COOLDOWN_MS, EMAIL_OTP_WINDOW_MS, EMAIL_OTP_MAX_REQUESTS, EMAIL_OTP_MAX_ATTEMPTS } from '../services/email/emailLoginOtp.js';

const challenges = () => getMongoDB().collection('emailLoginChallenges');

export async function issueEmailLoginChallenge({ email, challengeId, codeHash, expiresAt, now = new Date() }) {
  const windowCutoff = new Date(now.getTime() - EMAIL_OTP_WINDOW_MS);
  const newWindow = { $lte: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowCutoff] };
  try {
    await challenges().findOneAndUpdate({
      _id: email,
      $and: [
        { $or: [{ lastSentAt: { $exists: false } }, { lastSentAt: { $lte: new Date(now.getTime() - EMAIL_OTP_COOLDOWN_MS) } }] },
        { $or: [{ windowStartedAt: { $exists: false } }, { windowStartedAt: { $lte: windowCutoff } }, { requestCount: { $lt: EMAIL_OTP_MAX_REQUESTS } }] },
      ],
    }, [{ $set: {
      challengeId, codeHash, expiresAt, lastSentAt: now, attemptsRemaining: EMAIL_OTP_MAX_ATTEMPTS,
      consumedAt: '$$REMOVE',
      requestCount: { $cond: [newWindow, 1, { $add: ['$requestCount', 1] }] },
      windowStartedAt: { $cond: [newWindow, now, '$windowStartedAt'] },
      // Retain the quota after code expiry/consumption. Only this disposable collection has TTL.
      cleanupAt: new Date(now.getTime() + EMAIL_OTP_WINDOW_MS),
    } }], { upsert: true, returnDocument: 'after', projection: { _id: 1 } });
    return { issued: true };
  } catch (error) {
    // An existing _id that fails the cooldown/quota filter must not be overwritten.
    if (error.code === 11000) {
      const current = await challenges().findOne({ _id: email }, { projection: { lastSentAt: 1, requestCount: 1, windowStartedAt: 1 } });
      const availableAt = current?.requestCount >= EMAIL_OTP_MAX_REQUESTS
        ? current.windowStartedAt.getTime() + EMAIL_OTP_WINDOW_MS
        : (current?.lastSentAt?.getTime() ?? now.getTime()) + EMAIL_OTP_COOLDOWN_MS;
      return { issued: false, retryAfter: Math.max(1, Math.ceil((availableAt - now.getTime()) / 1000)) };
    }
    throw error;
  }
}

export async function consumeEmailLoginChallenge({ email, challengeId, codeHash, now = new Date() }) {
  const correct = { $eq: ['$codeHash', codeHash] };
  const row = await challenges().findOneAndUpdate({
    _id: email, challengeId, expiresAt: { $gt: now },
    attemptsRemaining: { $gt: 0 }, consumedAt: { $exists: false },
  }, [{ $set: {
    attemptsRemaining: { $subtract: ['$attemptsRemaining', 1] },
    consumedAt: { $cond: [correct, now, '$$REMOVE'] },
    codeHash: { $cond: [correct, '$$REMOVE', '$codeHash'] },
  } }], { returnDocument: 'after', projection: { _id: 1, consumedAt: 1 } });
  // Check and consume happen in one write: concurrent requests have one winner.
  return Boolean(row?.consumedAt);
}

export function invalidateEmailLoginChallenge(email, challengeId) {
  return challenges().updateOne({ _id: email, challengeId }, { $unset: { codeHash: '' }, $set: { consumedAt: new Date() } });
}

export function confirmOtpUserEmail(userId, email) {
  return getUsersCollection().updateOne({ id: userId, $or: [
    { emailNormalized: email }, { email, emailNormalized: { $exists: false } },
  ] }, {
    $set: { emailVerified: true, emailVerifiedAt: new Date() },
    $unset: { emailVerificationTokenHash: '', emailVerificationExpiresAt: '', emailVerificationLastSentAt: '' },
  });
}
