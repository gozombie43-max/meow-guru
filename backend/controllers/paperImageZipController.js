import multer from 'multer';
import { ZIP_LIMITS } from '../services/uploads/safeZip.js';
import { importPaperImageZip } from '../services/mock/paperImageZip.js';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: ZIP_LIMITS.compressedBytes, files: 1, fields: 2, fieldSize: 1024, parts: 3 } }).single('zipFile');
let processing = false;
export async function handlePaperImageZip(req, res) {
  // Bound expanded archives and image decoding per API process, including multipart buffering.
  if (processing) return res.status(503).json({ error: 'Another paper image ZIP is processing. Wait for it to finish, then retry.' });
  processing = true;
  try {
    const error = await new Promise(resolve => upload(req, res, resolve));
    if (error) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'ZIP exceeds 20 MiB. Split it into smaller uploads.' : 'Send one ZIP as zipFile, with expectedUpdatedAt and action fields only.' });
    await adminPaperImageZip(req, res);
  } finally { processing = false; }
}
export async function adminPaperImageZip(req, res) {
  try {
    if (!req.file || !/\.zip$/i.test(req.file.originalname)) return res.status(400).json({ error: 'Choose one .zip file containing manifest.json and images/.' });
    if (!['validate', 'apply'].includes(req.body.action)) return res.status(400).json({ error: 'action must be validate or apply.' });
    let expectedUpdatedAt;
    try { expectedUpdatedAt = JSON.parse(req.body.expectedUpdatedAt); }
    catch { return res.status(400).json({ error: 'Missing paper version. Reload the paper and try again.' }); }
    if (expectedUpdatedAt !== null && typeof expectedUpdatedAt !== 'string') return res.status(400).json({ error: 'Invalid paper version. Reload the paper.' });
    res.json(await importPaperImageZip({ buffer: req.file.buffer, examSlug: req.query.examSlug, slotId: req.params.slotId,
      examMode: req.query.examMode, expectedUpdatedAt, validateOnly: req.body.action === 'validate' }));
  } catch (error) { res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Could not import ZIP. Reload the paper to check its state before retrying.' }); }
}
