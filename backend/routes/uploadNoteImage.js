import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import adminAuth from '../middleware/auth.js';
import { putObject, stableImageUrl } from '../infrastructure/objectStorage.js';
import { imageBudget } from '../infrastructure/dependencyBoundary.js';
import { normalizeImage } from '../services/uploads/validatedImage.js';
import { trackPendingNoteImage } from '../repositories/noteImageRepository.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 1 } });

router.post('/', adminAuth, (req, res, next) => {
  upload.single('image')(req, res, error => {
    if (!error) return next();
    return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Images must be no larger than 5 MB' : 'Provide exactly one image file' });
  });
}, async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  try {
    const image = await imageBudget.execute(() => normalizeImage(req.file.buffer));
    const owner = Buffer.from(String(req.user.id)).toString('base64url');
    const key = `notes/images/pending/${owner}/${randomUUID()}.webp`;
    await trackPendingNoteImage(key, req.user.id);
    await putObject(key, image, 'image/webp');
    return res.json({ url: stableImageUrl(key), key });
  } catch (error) { return next(error); }
});

export default router;
