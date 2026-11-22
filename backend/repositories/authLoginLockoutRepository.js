import { createHash } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';

export const LOGIN_MAX_FAILED_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
export const EMAIL_RECOVERY_COOLDOWN_MS = 60 * 1000;
export const EMAIL_RECOVERY_WINDOW_MS = 60 * 60 * 1000;
export const EMAIL_RECOVERY_MAX_REQUESTS = 5;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const hashKey = (prefix, value) =>
  `${prefix}:${createHash('sha256').update(String(value)).digest('hex')}`;

function getRateLimitsCollectionOrNull() {
  try {
    return getMongoDB().collection('rateLimits');
  } catch {
    return null;
  }
}

export async function getLoginLockoutState(email, now = new Date()) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { locked: false, attempts: 0, retryAfterSeconds: 0 };
  }
  const col = getRateLimitsCollectionOrNull();
  if (!col) {
    return { locked: false, attempts: 0, retryAfterSeconds: 0 };
  }
  const maxAttempts = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || LOGIN_MAX_FAILED_ATTEMPTS);
  const windowMs = Number(process.env.AUTH_LOGIN_LOCKOUT_WINDOW_MS || LOGIN_LOCKOUT_WINDOW_MS);
  const id = hashKey('auth-login-lockout', normalized);

  const doc = await col.findOne({ _id: id }, { timeoutMS: 3000 });
  if (!doc) {
    return { locked: false, attempts: 0, retryAfterSeconds: 0 };
  }
  const resetTime = doc.resetTime ? new Date(doc.resetTime) : null;
  if (resetTime && resetTime <= now) {
    await col.deleteOne({ _id: id }).catch(() => {});
    return { locked: false, attempts: 0, retryAfterSeconds: 0 };
  }
  const attempts = Number(doc.totalHits ?? doc.attempts ?? 0);
  const remainingMs = resetTime ? Math.max(0, resetTime.getTime() - now.getTime()) : windowMs;
  return {
    locked: attempts >= maxAttempts,
    attempts,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}

export async function recordLoginFailure(email, now = new Date()) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { locked: false, attempts: 0, retryAfterSeconds: 0 };
  }
  const col = getRateLimitsCollectionOrNull();
  if (!col) {
    return { locked: false, attempts: 1, retryAfterSeconds: 0 };
  }
  const maxAttempts = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || LOGIN_MAX_FAILED_ATTEMPTS);
  const windowMs = Number(process.env.AUTH_LOGIN_LOCKOUT_WINDOW_MS || LOGIN_LOCKOUT_WINDOW_MS);
  const id = hashKey('auth-login-lockout', normalized);
  const nextResetTime = new Date(now.getTime() + windowMs);
  const expiredExpr = { $lte: [{ $ifNull: ['$resetTime', new Date(0)] }, now] };

  const write = () =>
    col.findOneAndUpdate(
      { _id: id },
      [
        {
          $set: {
            totalHits: {
              $cond: [expiredExpr, 1, { $add: [{ $ifNull: ['$totalHits', 0] }, 1] }],
            },
            resetTime: {
              $cond: [expiredExpr, nextResetTime, { $ifNull: ['$resetTime', nextResetTime] }],
            },
            updatedAt: now,
          },
        },
      ],
      { upsert: true, returnDocument: 'after', timeoutMS: 3000 },
    );

  let updated;
  try {
    updated = await write();
  } catch (error) {
    if (error?.code !== 11000) throw error;
    updated = await write();
  }

  const attempts = Number(updated?.totalHits ?? 1);
  const resetTime = updated?.resetTime ? new Date(updated.resetTime) : nextResetTime;
  const remainingMs = Math.max(0, resetTime.getTime() - now.getTime());

  return {
    locked: attempts >= maxAttempts,
    attempts,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}

export async function clearLoginFailures(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const col = getRateLimitsCollectionOrNull();
  if (!col) return;
  await col.deleteOne({ _id: hashKey('auth-login-lockout', normalized) }, { timeoutMS: 3000 });
}

export async function consumeEmailRecoveryQuota({ email, action, now = new Date() }) {
  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { allowed: false, retryAfterSeconds: Math.ceil(EMAIL_RECOVERY_COOLDOWN_MS / 1000) };
  }
  const col = getRateLimitsCollectionOrNull();
  if (!col) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  const safeAction = String(action || 'recovery').trim().toLowerCase();
  const id = hashKey(`auth-email-quota:${safeAction}`, normalized);
  const cooldownCutoff = new Date(now.getTime() - EMAIL_RECOVERY_COOLDOWN_MS);
  const windowCutoff = new Date(now.getTime() - EMAIL_RECOVERY_WINDOW_MS);
  const newWindowExpr = { $lte: [{ $ifNull: ['$windowStartedAt', new Date(0)] }, windowCutoff] };
  const resetTime = new Date(now.getTime() + EMAIL_RECOVERY_WINDOW_MS);

  try {
    await col.findOneAndUpdate(
      {
        _id: { $eq: id },
        $and: [
          { $or: [{ lastSentAt: { $exists: false } }, { lastSentAt: { $lte: cooldownCutoff } }] },
          {
            $or: [
              { windowStartedAt: { $exists: false } },
              { windowStartedAt: { $lte: windowCutoff } },
              { totalHits: { $lt: EMAIL_RECOVERY_MAX_REQUESTS } },
            ],
          },
        ],
      },
      [
        {
          $set: {
            lastSentAt: now,
            totalHits: { $cond: [newWindowExpr, 1, { $add: [{ $ifNull: ['$totalHits', 0] }, 1] }] },
            windowStartedAt: { $cond: [newWindowExpr, now, '$windowStartedAt'] },
            resetTime,
          },
        },
      ],
      { upsert: true, returnDocument: 'after', projection: { _id: 1 }, timeoutMS: 3000 },
    );
    return { allowed: true, retryAfterSeconds: 0 };
  } catch (error) {
    if (error?.code === 11000) {
      const current = await col.findOne(
        { _id: { $eq: id } },
        { projection: { lastSentAt: 1, totalHits: 1, windowStartedAt: 1 }, timeoutMS: 3000 },
      );
      const availableAt =
        current?.totalHits >= EMAIL_RECOVERY_MAX_REQUESTS && current?.windowStartedAt
          ? new Date(current.windowStartedAt).getTime() + EMAIL_RECOVERY_WINDOW_MS
          : (current?.lastSentAt ? new Date(current.lastSentAt).getTime() : now.getTime()) + EMAIL_RECOVERY_COOLDOWN_MS;
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((availableAt - now.getTime()) / 1000)),
      };
    }
    throw error;
  }
}
