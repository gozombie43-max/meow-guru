import { randomUUID } from 'node:crypto';
import { putObject, deleteObject, stableImageUrl } from '../infrastructure/objectStorage.js';
import { logger } from '../infrastructure/logger.js';

export async function storeQuestionImages(req, res, next) {
  const stored = [];
  const cleanup = () => Promise.all(stored.map(key => deleteObject(key).catch(err => logger.error({ err, key }, 'orphan image cleanup failed'))));
  try {
    for (const file of Object.values(req.files || {}).flat()) {
      const key = `question-images/uploads/${randomUUID()}`;
      await putObject(key, file.buffer, file.mimetype);
      stored.push(key);
      file.storageUrl = stableImageUrl(key);
    }
    res.once('finish', () => { if (res.statusCode >= 400) void cleanup(); });
    next();
  } catch (error) { await cleanup(); next(error); }
}
