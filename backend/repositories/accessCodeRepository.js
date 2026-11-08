import { getAccessCodesCollection, getMongoDB } from '../config/mongodb.js';

export const ACCESS_CODE_MAX_FAILED_ATTEMPTS = 5;
export const ACCESS_CODE_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export const findActiveAccessCode = code => getAccessCodesCollection().findOne({ code, active: true });
export const consumeAccessCode = (id, currentUsed, maxUses) => getAccessCodesCollection().updateOne(
  { _id: id, active: true, ...(maxUses > 0 ? { usedCount: currentUsed } : {}) }, { $inc: { usedCount: 1 } },
);

export async function getAccessCodeLockoutState(clientKey, now = new Date()) {
  const key = String(clientKey || 'unknown');
  const maxAttempts = Number(process.env.ACCESS_CODE_MAX_ATTEMPTS || ACCESS_CODE_MAX_FAILED_ATTEMPTS);
  const windowMs = Number(process.env.ACCESS_CODE_LOCKOUT_WINDOW_MS || ACCESS_CODE_LOCKOUT_WINDOW_MS);
  const col = getMongoDB().collection('accessCodeLockouts');

  const doc = await col.findOne({ _id: key });
  if (!doc) {
    return { locked: false, attempts: 0, retryAfterSeconds: 0 };
  }
  if (doc.expiresAt && new Date(doc.expiresAt) <= now) {
    await col.deleteOne({ _id: key });
    return { locked: false, attempts: 0, retryAfterSeconds: 0 };
  }
  const attempts = Number(doc.attempts || 0);
  const remainingMs = doc.expiresAt
    ? Math.max(0, new Date(doc.expiresAt).getTime() - now.getTime())
    : windowMs;
  return {
    locked: attempts >= maxAttempts,
    attempts,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}

export async function recordAccessCodeFailure(clientKey, now = new Date()) {
  const key = String(clientKey || 'unknown');
  const maxAttempts = Number(process.env.ACCESS_CODE_MAX_ATTEMPTS || ACCESS_CODE_MAX_FAILED_ATTEMPTS);
  const windowMs = Number(process.env.ACCESS_CODE_LOCKOUT_WINDOW_MS || ACCESS_CODE_LOCKOUT_WINDOW_MS);
  const expiresAt = new Date(now.getTime() + windowMs);
  const col = getMongoDB().collection('accessCodeLockouts');

  const existing = await col.findOne({ _id: key });
  if (existing && existing.expiresAt && new Date(existing.expiresAt) <= now) {
    await col.deleteOne({ _id: key });
  }

  const updated = await col.findOneAndUpdate(
    { _id: key },
    {
      $inc: { attempts: 1 },
      $setOnInsert: { createdAt: now, expiresAt },
    },
    { upsert: true, returnDocument: 'after' },
  );

  const attempts = Number(updated?.attempts ?? 1);
  const remainingMs = updated?.expiresAt
    ? Math.max(0, new Date(updated.expiresAt).getTime() - now.getTime())
    : windowMs;

  return {
    locked: attempts >= maxAttempts,
    attempts,
    retryAfterSeconds: Math.max(1, Math.ceil(remainingMs / 1000)),
  };
}

export async function clearAccessCodeFailures(clientKey) {
  const key = String(clientKey || 'unknown');
  await getMongoDB().collection('accessCodeLockouts').deleteOne({ _id: key });
}
