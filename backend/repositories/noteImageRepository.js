import { randomUUID } from 'node:crypto';
import { getMongoDB, getNotesCollection } from '../config/mongodb.js';
const images = () => getMongoDB().collection('noteImages');
const hours = value => value * 60 * 60 * 1000;
export const noteImageInventoryCursor = () => getMongoDB().collection('runtimeMaintenance').findOne({ _id: 'note-image-inventory' });
export const saveNoteImageInventoryCursor = token => getMongoDB().collection('runtimeMaintenance').updateOne({ _id: 'note-image-inventory' }, { $set: { token: token || null } }, { upsert: true });
export const trackLegacyNoteImage = (key, now = new Date()) => images().updateOne({ _id: key }, { $setOnInsert: { state: 'pending', createdAt: now, cleanupAfter: now } }, { upsert: true });

export function trackPendingNoteImage(key, userId, now = new Date()) {
  return images().insertOne({ _id: key, userId: String(userId), state: 'pending', createdAt: now, cleanupAfter: new Date(+now + hours(48)) });
}

export async function retainNoteImages(keys, now = new Date()) {
  for (const key of keys) {
    try {
      // A cleanup claim and a save cannot acquire the same object concurrently.
      await images().updateOne({ _id: key, state: { $ne: 'deleting' } }, {
        $set: { state: 'attached', cleanupAfter: new Date(+now + hours(48)) },
        $setOnInsert: { createdAt: now },
      }, { upsert: true });
    } catch (error) {
      if (error.code !== 11000) throw error;
      throw Object.assign(new Error('A note image is being cleaned up. Upload it again before saving.'), { statusCode: 409 });
    }
  }
}

export async function scheduleNoteImageCleanup(keys, now = new Date()) {
  // Saving/deleting the note precedes scheduling. Shared images are checked by the worker.
  for (const key of keys) {
    await images().updateOne({ _id: key }, { $set: { cleanupAfter: now }, $setOnInsert: { state: 'pending', createdAt: now } }, { upsert: true });
  }
}

export async function claimNoteImageCleanup(now = new Date()) {
  const owner = randomUUID();
  return images().findOneAndUpdate({ cleanupAfter: { $lte: now }, $or: [{ state: { $ne: 'deleting' } }, { leaseUntil: { $lte: now } }] }, {
    $set: { state: 'deleting', owner, leaseUntil: new Date(+now + hours(1)) },
  }, { sort: { cleanupAfter: 1 }, returnDocument: 'after' });
}

export async function isNoteImageReferenced(key) {
  const encoded = Buffer.from(key).toString('base64url');
  return Boolean(await getNotesCollection().findOne({ $or: [{ imageKeys: key }, { body: { $regex: `/api/upload/image/${encoded}(?:[^A-Za-z0-9_-]|$)` } }] }, { projection: { _id: 1 } }));
}
export const finishNoteImageCleanup = row => images().deleteOne({ _id: row._id, owner: row.owner, state: 'deleting' });
export const deferNoteImageCleanup = (row, referenced, now = new Date()) => images().updateOne({ _id: row._id, owner: row.owner }, {
  $set: { state: referenced ? 'attached' : 'pending', cleanupAfter: new Date(+now + (referenced ? hours(24) : hours(1))) },
  $unset: { owner: '', leaseUntil: '' },
});
