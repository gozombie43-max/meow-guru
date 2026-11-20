import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { putObject, deleteObject, stableImageUrl } from '../infrastructure/objectStorage.js';
import { logger } from '../infrastructure/logger.js';

const ALLOWED_FORMATS = new Set(['png', 'jpeg', 'webp', 'gif']);

export async function storeQuestionImages(req, res, next) {
  const stored = [];
  const cleanup = () => Promise.all(stored.map(key => deleteObject(key).catch(err => logger.error({ err, key }, 'orphan image cleanup failed'))));
  try {
    for (const file of Object.values(req.files || {}).flat()) {
      const meta = await sharp(file.buffer, { limitInputPixels: 25_000_000 }).metadata();
      if (!meta.format || !ALLOWED_FORMATS.has(meta.format)) {
        const err = new Error('Unsupported question image format; upload PNG, JPEG, WebP, or GIF');
        err.statusCode = 400;
        throw err;
      }
      const webpBuffer = await sharp(file.buffer, { limitInputPixels: 25_000_000 })
        .rotate()
        .webp({ quality: 82 })
        .toBuffer();
      const key = `question-images/uploads/${randomUUID()}.webp`;
      await putObject(key, webpBuffer, 'image/webp');
      stored.push(key);
      file.storageUrl = stableImageUrl(key);
    }
    res.once('finish', () => { if (res.statusCode >= 400) void cleanup(); });
    next();
  } catch (error) {
    await cleanup();
    if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
    if (/Input buffer|unsupported image format/i.test(String(error.message || ''))) {
      return res.status(400).json({ error: 'Invalid or corrupted image file' });
    }
    next(error);
  }
}
