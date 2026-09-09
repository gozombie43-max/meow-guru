import { createHash, randomUUID } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';
import { putObject } from '../infrastructure/objectStorage.js';

const jobs = () => getMongoDB().collection('runtimeJobs');
export async function enqueueTutorJob(userId, input, file, idempotencyKey) {
  if (idempotencyKey && !/^[a-zA-Z0-9_-]{8,100}$/.test(idempotencyKey)) throw Object.assign(new Error('Invalid Idempotency-Key'), { status: 400 });
  const bytes = Buffer.from(JSON.stringify({ input, file: { originalname: file.originalname, mimetype: file.mimetype, data: file.buffer.toString('base64') } }));
  const hash = value => createHash('sha256').update(value).digest('hex');
  const payloadHash = hash(bytes);
  const id = hash(`${userId}:${idempotencyKey || randomUUID()}`);
  const key = `tutor-jobs/${id}/input.json`;
  const doc = { _id: id, kind: 'tutor', userId, payloadHash, inputKey: key, status: 'staging', attempts: 0, createdAt: new Date(), availableAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000) };
  try { await jobs().insertOne(doc); }
  catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await jobs().findOne({ _id: id, userId });
    if (existing?.payloadHash !== payloadHash) throw Object.assign(new Error('Idempotency key was used with different input'), { status: 409 });
    if (existing.status !== 'staging') return existing;
  }
  await putObject(key, bytes, 'application/json');
  await jobs().updateOne({ _id: id, status: 'staging' }, { $set: { status: 'queued', availableAt: new Date() } });
  return jobs().findOne({ _id: id, userId });
}
export function getTutorJob(userId, id) { return jobs().findOne({ _id: id, userId, kind: 'tutor', expiresAt: { $gt: new Date() } }); }
export async function cancelTutorJob(userId, id) {
  const result = await jobs().updateOne({ _id: id, userId, kind: 'tutor', status: { $in: ['staging', 'queued', 'running'] } }, { $set: { status: 'cancelled', finishedAt: new Date() }, $unset: { owner: '', leaseUntil: '' } });
  return result.modifiedCount === 1;
}
