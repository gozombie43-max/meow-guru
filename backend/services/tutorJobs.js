import { createHash, randomUUID } from 'node:crypto';
import { insertTutorJob, findStagedTutorJob, queueStagedTutorJob, findTutorJob, cancelOwnedTutorJob } from '../repositories/tutorJobRepository.js';
import { putObject } from '../infrastructure/objectStorage.js';
import { traceCarrier } from '../infrastructure/tracing.js';

export async function enqueueTutorJob(userId, input, file, idempotencyKey) {
  if (idempotencyKey && !/^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey)) throw Object.assign(new Error('Invalid Idempotency-Key'), { status: 400 });
  const bytes = Buffer.from(JSON.stringify({ input, file: { originalname: file.originalname, mimetype: file.mimetype, data: file.buffer.toString('base64') } }));
  const hash = value => createHash('sha256').update(value).digest('hex');
  const payloadHash = hash(bytes);
  const id = hash(`${userId}:${idempotencyKey || randomUUID()}`);
  const key = `tutor-jobs/${id}/input.json`;
  const doc = { _id: id, kind: 'tutor', userId, payloadHash, inputKey: key, trace: traceCarrier(), status: 'staging', attempts: 0, createdAt: new Date(), availableAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000) };
  try { await insertTutorJob(doc); }
  catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await findStagedTutorJob(userId, id);
    if (existing?.payloadHash !== payloadHash) throw Object.assign(new Error('Idempotency key was used with different input'), { status: 409 });
    if (existing.status !== 'staging') return existing;
  }
  await putObject(key, bytes, 'application/json');
  await queueStagedTutorJob(id);
  return findStagedTutorJob(userId, id);
}
export { findTutorJob as getTutorJob, cancelOwnedTutorJob as cancelTutorJob };
