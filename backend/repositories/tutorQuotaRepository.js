import { randomUUID } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';
import { tutorPolicy, tutorTokenAllowance } from '../services/tutorPolicy.js';

export async function reserveTutorUsage(userId, input, attachmentBytes = 0, now = new Date(), reservationId = randomUUID()) {
  const limits = tutorPolicy();
  const tokens = tutorTokenAllowance(input, attachmentBytes > 0);
  if (attachmentBytes > limits.TUTOR_DAILY_ATTACHMENT_BYTES || tokens > limits.TUTOR_DAILY_TOKEN_ALLOWANCE) {
    throw Object.assign(new Error('This request exceeds your daily Tutor allowance.'), { statusCode: 429 });
  }
  const id = `${userId}:${now.toISOString().slice(0, 10)}`;
  const reservation = {
    id,
    userId: String(userId),
    reservationId,
    attachmentBytes,
    tokens,
  };
  try {
    await getMongoDB().collection('tutorDailyUsage').updateOne({
      _id: id,
      requestIds: { $ne: reservationId },
      requests: { $not: { $gte: limits.TUTOR_DAILY_REQUESTS } },
      attachmentBytes: { $not: { $gt: limits.TUTOR_DAILY_ATTACHMENT_BYTES - attachmentBytes } },
      tokens: { $not: { $gt: limits.TUTOR_DAILY_TOKEN_ALLOWANCE - tokens } },
    }, {
      $inc: { requests: 1, attachmentBytes, tokens },
      $addToSet: { requestIds: reservationId },
      $setOnInsert: { userId: String(userId), expiresAt: new Date(+now + 3 * 86400000) },
    }, { upsert: true });
    return reservation;
  } catch (error) {
    if (error.code !== 11000) throw error;
    if (await getMongoDB().collection('tutorDailyUsage').findOne({ _id: id, requestIds: reservationId }, { projection: { _id: 1 } })) {
      return reservation;
    }
    throw Object.assign(new Error('Your daily Tutor allowance has been reached. Please try again tomorrow.'), { statusCode: 429 });
  }
}

export async function releaseTutorUsage(reservationOrUserId, fallback = {}) {
  let id;
  let reservationId;
  let attachmentBytes = 0;
  let tokens = 0;

  if (reservationOrUserId && typeof reservationOrUserId === 'object') {
    id = reservationOrUserId.id;
    reservationId = reservationOrUserId.reservationId;
    attachmentBytes = Number(reservationOrUserId.attachmentBytes || 0);
    tokens = Number(reservationOrUserId.tokens || 0);
    if (!id && reservationOrUserId.userId) {
      const now = reservationOrUserId.now instanceof Date ? reservationOrUserId.now : new Date();
      id = `${reservationOrUserId.userId}:${now.toISOString().slice(0, 10)}`;
    }
    if (!tokens && reservationOrUserId.input !== undefined) {
      tokens = tutorTokenAllowance(reservationOrUserId.input, attachmentBytes > 0);
    }
  } else {
    const userId = reservationOrUserId || fallback.userId;
    if (!userId) return false;
    const now = fallback.now instanceof Date ? fallback.now : new Date();
    id = fallback.id || `${userId}:${now.toISOString().slice(0, 10)}`;
    reservationId = fallback.reservationId;
    attachmentBytes = Number(fallback.attachmentBytes || 0);
    tokens = fallback.tokens !== undefined
      ? Number(fallback.tokens)
      : tutorTokenAllowance(fallback.input || {}, attachmentBytes > 0);
  }

  if (!id) return false;

  const collection = getMongoDB().collection('tutorDailyUsage');
  if (reservationId) {
    const result = await collection.updateOne(
      { _id: id, requestIds: reservationId },
      {
        $inc: {
          requests: -1,
          attachmentBytes: -attachmentBytes,
          tokens: -tokens,
        },
        $pull: { requestIds: reservationId },
      },
    );
    return result.modifiedCount === 1;
  }

  const result = await collection.updateOne(
    { _id: id, requests: { $gt: 0 } },
    {
      $inc: {
        requests: -1,
        attachmentBytes: -attachmentBytes,
        tokens: -tokens,
      },
    },
  );
  return result.modifiedCount === 1;
}

export async function acquireTutorSlot(userId, kind, identity = randomUUID(), now = new Date()) {
  const limits = tutorPolicy();
  const count = kind === 'running' ? limits.TUTOR_RUNNING_JOBS : limits.TUTOR_QUEUED_JOBS;
  const collection = getMongoDB().collection('tutorSlots');
  for (let slot = 0; slot < count; slot++) {
    const id = `${kind}:${userId}:${slot}`;
    try {
      const row = await collection.findOneAndUpdate({ _id: id, $or: [{ expiresAt: { $lte: now } }, { identity }] }, {
        $set: { identity, userId: String(userId), expiresAt: new Date(+now + (kind === 'running' ? 180_000 : 7 * 86400000)) },
      }, { upsert: true, returnDocument: 'after' });
      if (row) return { id, identity };
    } catch (error) { if (error.code !== 11000) throw error; }
  }
  throw Object.assign(new Error(`Your Tutor ${kind === 'running' ? 'processing' : 'attachment queue'} limit has been reached. Please wait.`), { statusCode: 429 });
}
export const releaseTutorSlot = slot => getMongoDB().collection('tutorSlots').deleteOne({ _id: slot.id, identity: slot.identity });
