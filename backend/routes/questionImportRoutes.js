import express from 'express';
import multer from 'multer';
import path from 'node:path';
import adminAuth from '../middleware/auth.js';
import { uploadLimiter } from '../middleware/rateLimiter.js';
import * as imports from '../services/questionImport/questionImportService.js';
import { nudgeQuestionImportWorker } from '../services/questionImport/questionImportWorker.js';

const router = express.Router();
const { IMPORT_LIMITS } = imports;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMPORT_LIMITS.maxFileBytes, files: IMPORT_LIMITS.maxFiles, fields: 40 },
  fileFilter: (req, file, cb) => {
    if (IMPORT_LIMITS.extensions.includes(path.extname(file.originalname || '').toLowerCase())) cb(null, true);
    else cb(Object.assign(new Error(`${file.originalname}: only .ndjson, .jsonl or .json files are supported`), { statusCode: 400 }));
  },
});

const ownerOf = req => String(req.user?.id ?? req.user?._id ?? req.user?.uid ?? '');
const send = handler => async (req, res) => {
  try { await handler(req, res); }
  catch (error) {
    if (res.headersSent) { res.end(); return; }
    const status = error instanceof multer.MulterError ? (error.code === 'LIMIT_FILE_SIZE' ? 413 : 400) : (error.statusCode || error.status || 500);
    const message = error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE' ? `File exceeds ${IMPORT_LIMITS.maxFileBytes / 1048576} MB` : error.message;
    res.status(status).json({ error: status >= 500 ? 'Import service error' : message, ...(error.code && status < 500 ? { code: error.code } : {}) });
  }
};
// Run multer inside the handler so its errors use the JSON error shape above.
const runUpload = (middleware, req, res) => new Promise((resolve, reject) => middleware(req, res, error => (error ? reject(error) : resolve())));
const parseMappings = raw => { try { const value = JSON.parse(raw || '[]'); return Array.isArray(value) ? value : []; } catch { return []; } };

router.use(adminAuth);
router.use(express.json({ limit: '256kb' }));

router.get('/', send(async (req, res) => res.json({ jobs: await imports.listJobs(ownerOf(req)) })));
router.post('/', send(async (req, res) => res.status(201).json({ job: imports.presentJob(await imports.createJob({ examMode: req.body?.examMode ?? req.query.examMode, createdBy: ownerOf(req) })) })));
router.get('/:id', send(async (req, res) => res.json({ job: imports.presentJob(await imports.getJob(req.params.id, ownerOf(req))) })));
router.patch('/:id', send(async (req, res) => res.json({ job: imports.presentJob(await imports.saveMappings(req.params.id, ownerOf(req), req.body?.files)) })));
router.delete('/:id', send(async (req, res) => { await imports.discardJob(req.params.id, ownerOf(req)); res.status(204).end(); }));

router.post('/:id/files', uploadLimiter, send(async (req, res) => {
  await runUpload(upload.array('files', IMPORT_LIMITS.maxFiles), req, res);
  const { job, warnings } = await imports.addFiles(req.params.id, ownerOf(req), req.files || [], parseMappings(req.body?.mappings));
  res.status(201).json({ job: imports.presentJob(job), warnings });
}));
router.put('/:id/files/:fileId', uploadLimiter, send(async (req, res) => {
  await runUpload(upload.single('file'), req, res);
  const { job, warnings } = await imports.replaceFile(req.params.id, ownerOf(req), req.params.fileId, req.file);
  res.json({ job: imports.presentJob(job), warnings });
}));
router.delete('/:id/files/:fileId', send(async (req, res) => res.json({ job: imports.presentJob(await imports.removeFile(req.params.id, ownerOf(req), req.params.fileId)) })));
router.get('/:id/files/:fileId/preview', send(async (req, res) => res.json(await imports.previewFile(req.params.id, ownerOf(req), req.params.fileId))));
router.get('/:id/files/:fileId/report', send(async (req, res) => imports.writeIssueReport(req.params.id, ownerOf(req), req.params.fileId, res)));

router.post('/:id/validate', send(async (req, res) => {
  const job = await imports.startValidation(req.params.id, ownerOf(req));
  nudgeQuestionImportWorker();
  res.status(202).json({ job: imports.presentJob(job) });
}));
router.post('/:id/import', send(async (req, res) => {
  const job = await imports.startImport(req.params.id, ownerOf(req), req.body || {});
  nudgeQuestionImportWorker();
  res.status(202).json({ job: imports.presentJob(job) });
}));

export default router;
