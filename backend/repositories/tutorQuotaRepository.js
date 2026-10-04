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
  } catch (error) {
    if (error.code !== 11000) throw error;
    if (await getMongoDB().collection('tutorDailyUsage').findOne({ _id: id, requestIds: reservationId }, { projection: { _id: 1 } })) return;
    throw Object.assign(new Error('Your daily Tutor allowance has been reached. Please try again tomorrow.'), { statusCode: 429 });
  }
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
