import { randomUUID } from 'node:crypto';
import { getMongoDB } from '../config/mongodb.js';

export async function acquireAiLease(userId, now = new Date()) {
  const collection = getMongoDB().collection('aiLeases');
  const owner = randomUUID();
  for (let slot = 0; slot < 2; slot++) {
    const id = `${userId}:${slot}`;
    try {
      const row = await collection.findOneAndUpdate(
        { _id: id, expiresAt: { $lte: now } },
        { $set: { owner, userId: String(userId), expiresAt: new Date(+now + 120_000) } },
        { upsert: true, returnDocument: 'after' },
      );
      if (row) return Object.assign(() => collection.deleteOne({ _id: id, owner }), { leaseId: owner });
    } catch (error) { if (error.code !== 11000) throw error; }
  }
  throw Object.assign(new Error('Two AI requests are already processing. Please wait.'), { statusCode: 429 });
}

export function releaseAiLease(userId, leaseId) {
  return getMongoDB().collection('aiLeases').deleteOne({ userId: String(userId), owner: String(leaseId) });
}

export async function aiAdmission(req, res, next) {
  try {
    const release = await acquireAiLease(String(req.user.id));
    let released = false;
    const done = () => { if (!released) { released = true; void release().catch(() => {}); } };
    res.once('finish', done); res.once('close', done);
    next();
  } catch (error) { next(error); }
}
