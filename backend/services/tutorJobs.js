import { createHash, randomUUID } from 'node:crypto';
import { insertTutorJob, findStagedTutorJob, queueStagedTutorJob, findTutorJob, cancelOwnedTutorJob, trackTutorObject, beginTutorUpload, releaseTutorUpload } from '../repositories/tutorJobRepository.js';
import * as tutorQuotaRepo from '../repositories/tutorQuotaRepository.js';
import { putObject } from '../infrastructure/objectStorage.js';
import { traceCarrier } from '../infrastructure/tracing.js';

const acquireTutorSlot = (...args) => tutorQuotaRepo.acquireTutorSlot(...args);
const releaseTutorSlot = (...args) =>
  'releaseTutorSlot' in tutorQuotaRepo && typeof tutorQuotaRepo.releaseTutorSlot === 'function'
    ? Promise.resolve(tutorQuotaRepo.releaseTutorSlot(...args))
    : Promise.resolve(undefined);
const reserveTutorUsage = (...args) => tutorQuotaRepo.reserveTutorUsage(...args);
const releaseTutorUsage = (...args) =>
  'releaseTutorUsage' in tutorQuotaRepo && typeof tutorQuotaRepo.releaseTutorUsage === 'function'
    ? Promise.resolve(tutorQuotaRepo.releaseTutorUsage(...args))
    : Promise.resolve(false);

export async function enqueueTutorJob(userId, input, file, idempotencyKey) {
  if (idempotencyKey && !/^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey)) throw Object.assign(new Error('Invalid Idempotency-Key'), { statusCode: 400 });
  const hash = value => createHash('sha256').update(value).digest('hex');
  const payloadHash = hash(JSON.stringify({ input, name: file.originalname, type: file.mimetype, fileHash: hash(file.buffer) }));
  const id = hash(`${userId}:${idempotencyKey || randomUUID()}`);
  let doc = await findStagedTutorJob(userId, id);
  if (doc) {
    if (doc.payloadHash !== payloadHash) throw Object.assign(new Error('Idempotency key was used with different input'), { statusCode: 409 });
    if (doc.status !== 'staging') return doc;
  } else {
    const slot = await acquireTutorSlot(userId, 'queued');
    let reservation;
    try {
      const now = new Date();
      reservation = await reserveTutorUsage(userId, input, file.buffer.length, now, `${id}:${payloadHash}`);
      doc = { _id: id, kind: 'tutor', userId, payloadHash, input, attachmentKey: `tutor-jobs/${id}/${randomUUID()}/attachment`, attachment: { originalname: file.originalname, mimetype: file.mimetype }, attachmentBytes: file.buffer.length, quotaReservation: reservation, queueSlot: slot, trace: traceCarrier(), status: 'staging', attempts: 0, createdAt: now, availableAt: now, expiresAt: new Date(+now + 7 * 86400000) };
      await insertTutorJob(doc);
    } catch (error) {
      if (error.code !== 11000) {
        if (reservation) await releaseTutorUsage(reservation, { userId, input, attachmentBytes: file.buffer.length, reservationId: `${id}:${payloadHash}` }).catch(() => {});
        await releaseTutorSlot(slot);
        throw error;
      }
      await releaseTutorSlot(slot);
      doc = await findStagedTutorJob(userId, id);
      if (doc?.payloadHash !== payloadHash) throw Object.assign(new Error('Idempotency key was used with different input'), { statusCode: 409 });
      if (doc.status !== 'staging') return doc;
    }
  }
  const uploadOwner = randomUUID();
  if (!await beginTutorUpload(id, uploadOwner)) return findStagedTutorJob(userId, id);
  const key = doc.attachmentKey;
  // Registry survives job TTL deletion, so expired/abandoned inputs remain collectible.
  try {
    await trackTutorObject(id, key, new Date(+doc.expiresAt + 3600000));
    await putObject(key, file.buffer, file.mimetype);
    await queueStagedTutorJob(id, uploadOwner);
  } catch (error) {
    await releaseTutorUsage(doc.quotaReservation, {
      userId,
      input,
      attachmentBytes: file.buffer.length,
      now: doc.createdAt,
      reservationId: `${id}:${payloadHash}`,
    }).catch(() => {});
    if (doc.queueSlot) await releaseTutorSlot(doc.queueSlot).catch(() => {});
    throw error;
  } finally { await releaseTutorUpload(id, uploadOwner); }
  return findStagedTutorJob(userId, id);
}

export async function cancelTutorJob(userId, id) {
  const existing = await findStagedTutorJob(userId, id);
  const cancelled = await cancelOwnedTutorJob(userId, id);
  if (cancelled && existing) {
    await releaseTutorUsage(existing.quotaReservation, {
      userId,
      input: existing.input,
      attachmentBytes: existing.attachmentBytes || 0,
      now: existing.createdAt,
      reservationId: existing.payloadHash ? `${existing._id}:${existing.payloadHash}` : undefined,
    }).catch(() => {});
    if (existing.queueSlot) await releaseTutorSlot(existing.queueSlot).catch(() => {});
  }
  return cancelled;
}

export { findTutorJob as getTutorJob };
