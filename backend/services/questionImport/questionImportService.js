import { randomUUID, createHash } from 'node:crypto';
import path from 'node:path';
import { parseQuestionExamMode } from '../questions/questionExamMode.js';
import * as repo from '../../repositories/questionImportRepository.js';
import { stageFile, deleteStagedFile, openStagedStream } from './importStaging.js';
import { detectFormat, parseRecords, ImportFormatError } from './streamParser.js';

export const IMPORT_LIMITS = Object.freeze({
  maxFiles: 10,
  maxFileBytes: 25 * 1024 * 1024,
  maxRowsPerFile: 50_000,
  extensions: ['.ndjson', '.jsonl', '.json'],
});
const EDITABLE = ['draft', 'validated'];
const DRAFT_TTL_MS = 14 * 86_400_000;
const DONE_TTL_MS = 7 * 86_400_000;

const httpError = (statusCode, message, code) => Object.assign(new Error(message), { statusCode, ...(code ? { code } : {}) });
const emptyCounts = () => ({ total: 0, valid: 0, invalid: 0, duplicate: 0, warning: 0, imported: 0, failed: 0 });
const pendingChecks = () => ({ format: 'pending', schema: 'pending', duplicates: 'pending', mapping: 'pending' });
const touch = (extra = {}) => ({ updatedAt: new Date(), expiresAt: new Date(Date.now() + DRAFT_TTL_MS), ...extra });
// Any edit invalidates the previous validation result.
const resetToDraft = () => touch({ status: 'draft', fingerprint: null, validatedAt: null });

function cleanMapping(mapping = {}) {
  const pick = key => String(mapping[key] ?? '').trim().slice(0, 200);
  return { subject: pick('subject'), topic: pick('topic'), quizName: pick('quizName'), chapterSlug: pick('chapterSlug'), chapterTitle: pick('chapterTitle') };
}

export function batchFingerprint(job) {
  const material = job.files.map(file => [file.id, file.sha256, cleanMapping(file.mapping)]);
  return createHash('sha256').update(JSON.stringify([job.examMode, material])).digest('hex');
}

// Public projection: never leak staging ids.
export function presentJob(job) {
  if (!job) return null;
  const { lease, createdBy, ...rest } = job;
  return {
    ...rest,
    running: Boolean(job.phase),
    limits: { maxFiles: IMPORT_LIMITS.maxFiles, maxFileBytes: IMPORT_LIMITS.maxFileBytes, maxRowsPerFile: IMPORT_LIMITS.maxRowsPerFile },
    files: job.files.map(({ gridFsId, ...file }) => file),
  };
}

async function requireJob(id, createdBy) {
  const job = await repo.findJob(id, createdBy);
  if (!job) throw httpError(404, 'Import batch not found');
  return job;
}
function requireEditable(job) {
  if (!EDITABLE.includes(job.status)) throw httpError(409, `Batch is ${job.status} and can no longer be edited`, 'BATCH_LOCKED');
}

export async function createJob({ examMode, createdBy }) {
  const mode = parseQuestionExamMode(examMode) || 'ssc';
  const now = new Date();
  const job = { _id: `imp_${randomUUID()}`, createdBy, examMode: mode, status: 'draft', phase: null, lease: null, attempts: 0, files: [], fingerprint: null, createdAt: now, ...touch() };
  await repo.insertJob(job);
  return job;
}

export const getJob = requireJob;
export const listJobs = createdBy => repo.listJobs(createdBy);

async function prepareUpload(job, upload) {
  const name = String(upload.originalname || 'questions.ndjson').slice(0, 200);
  const extension = path.extname(name).toLowerCase();
  if (!IMPORT_LIMITS.extensions.includes(extension)) throw httpError(400, `${name}: only .ndjson, .jsonl or .json files are supported`);
  if (!upload.buffer?.length) throw httpError(400, `${name}: file is empty`);
  if (upload.buffer.length > IMPORT_LIMITS.maxFileBytes) throw httpError(413, `${name}: exceeds ${IMPORT_LIMITS.maxFileBytes / 1048576} MB`);
  let format;
  try { format = detectFormat(upload.buffer); }
  catch (error) { if (error instanceof ImportFormatError) throw httpError(400, `${name}: ${error.message}`); throw error; }
  const { gridFsId, sha256 } = await stageFile(upload.buffer, { filename: name, jobId: job._id });
  return { name, size: upload.buffer.length, format, gridFsId, sha256 };
}

function duplicateWarnings(files) {
  const warnings = [];
  const seenNames = new Map(), seenHashes = new Map();
  for (const file of files) {
    if (seenNames.has(file.name.toLowerCase())) warnings.push(`"${file.name}" appears more than once in this batch`);
    else if (seenHashes.has(file.sha256)) warnings.push(`"${file.name}" has identical content to "${seenHashes.get(file.sha256)}"`);
    seenNames.set(file.name.toLowerCase(), true);
    seenHashes.set(file.sha256, file.name);
  }
  return warnings;
}

export async function addFiles(id, createdBy, uploads, mappings = []) {
  const job = await requireJob(id, createdBy);
  requireEditable(job);
  if (!uploads.length) throw httpError(400, 'No files received');
  if (job.files.length + uploads.length > IMPORT_LIMITS.maxFiles) throw httpError(400, `A batch can contain at most ${IMPORT_LIMITS.maxFiles} files (${IMPORT_LIMITS.maxFiles - job.files.length} slots left)`, 'BATCH_FULL');
  const staged = [];
  try {
    for (const [index, upload] of uploads.entries()) {
      const prepared = await prepareUpload(job, upload);
      staged.push({ id: `f_${randomUUID().slice(0, 12)}`, ...prepared, mapping: cleanMapping(mappings[index]), status: 'pending', counts: emptyCounts(), checks: pendingChecks(), issues: [], issueCount: 0, checkpoint: { nextRow: 0 }, addedAt: new Date() });
    }
  } catch (error) {
    await Promise.all(staged.map(file => deleteStagedFile(file.gridFsId)));
    throw error;
  }
  const updated = await repo.updateJob(id, createdBy, { status: { $in: EDITABLE }, [`files.${IMPORT_LIMITS.maxFiles - staged.length}`]: { $exists: false } }, { $push: { files: { $each: staged } }, $set: resetToDraft() });
  if (!updated) {
    await Promise.all(staged.map(file => deleteStagedFile(file.gridFsId)));
    throw httpError(409, 'Batch changed while uploading; refresh and try again');
  }
  return { job: updated, warnings: duplicateWarnings(updated.files) };
}

export async function replaceFile(id, createdBy, fileId, upload) {
  const job = await requireJob(id, createdBy);
  requireEditable(job);
  const existing = job.files.find(file => file.id === fileId);
  if (!existing) throw httpError(404, 'File not found in batch');
  if (!upload) throw httpError(400, 'No file received');
  const prepared = await prepareUpload(job, upload);
  const updated = await repo.updateJob(id, createdBy, { status: { $in: EDITABLE }, 'files.id': fileId }, {
    $set: {
      'files.$.name': prepared.name, 'files.$.size': prepared.size, 'files.$.format': prepared.format, 'files.$.gridFsId': prepared.gridFsId, 'files.$.sha256': prepared.sha256,
      'files.$.status': 'pending', 'files.$.counts': emptyCounts(), 'files.$.checks': pendingChecks(), 'files.$.issues': [], 'files.$.issueCount': 0, 'files.$.checkpoint': { nextRow: 0 },
      ...resetToDraft(),
    },
  });
  if (!updated) { await deleteStagedFile(prepared.gridFsId); throw httpError(409, 'Batch changed while uploading; refresh and try again'); }
  await deleteStagedFile(existing.gridFsId);
  await repo.clearIssues(job._id, fileId);
  return { job: updated, warnings: duplicateWarnings(updated.files) };
}

export async function removeFile(id, createdBy, fileId) {
  const job = await requireJob(id, createdBy);
  requireEditable(job);
  const existing = job.files.find(file => file.id === fileId);
  if (!existing) throw httpError(404, 'File not found in batch');
  const updated = await repo.updateJob(id, createdBy, { status: { $in: EDITABLE } }, { $pull: { files: { id: fileId } }, $set: resetToDraft() });
  if (!updated) throw httpError(409, 'Batch is locked');
  await deleteStagedFile(existing.gridFsId);
  await repo.clearIssues(job._id, fileId);
  return updated;
}

export async function saveMappings(id, createdBy, entries = []) {
  const job = await requireJob(id, createdBy);
  requireEditable(job);
  const byId = new Map((Array.isArray(entries) ? entries : []).map(entry => [String(entry?.id), cleanMapping(entry?.mapping)]));
  let changed = false;
  const files = job.files.map(file => {
    const mapping = byId.get(file.id);
    if (!mapping || JSON.stringify(mapping) === JSON.stringify(cleanMapping(file.mapping))) return file;
    changed = true;
    return { ...file, mapping, status: 'pending', checks: pendingChecks() };
  });
  if (!changed) return job;
  const updated = await repo.updateJob(id, createdBy, { status: { $in: EDITABLE }, updatedAt: job.updatedAt }, { $set: { files, ...resetToDraft() } });
  if (!updated) throw httpError(409, 'Batch changed concurrently; refresh and try again');
  return updated;
}

export async function startValidation(id, createdBy) {
  const job = await requireJob(id, createdBy);
  requireEditable(job);
  if (!job.files.length) throw httpError(400, 'Add at least one file before validating');
  const files = job.files.map(file => ({ ...file, status: 'queued', checks: pendingChecks() }));
  const fingerprint = batchFingerprint(job);
  const updated = await repo.updateJob(id, createdBy, { status: { $in: EDITABLE }, updatedAt: job.updatedAt }, {
    $set: { files, status: 'validating', phase: 'validate', lease: null, attempts: 0, fingerprint, error: null, progress: { phase: 'validate', fileIndex: 0 }, ...touch() },
  });
  if (!updated) throw httpError(409, 'Batch changed concurrently; refresh and try again');
  return updated;
}

const IMPORTABLE = ['ready', 'needs_review', 'failed'];
export async function startImport(id, createdBy, { confirm, fingerprint } = {}) {
  if (confirm !== true) throw httpError(400, 'Import requires explicit confirmation', 'CONFIRMATION_REQUIRED');
  const job = await requireJob(id, createdBy);
  const retry = job.status === 'partially_failed';
  if (job.status !== 'validated' && !retry) throw httpError(409, 'Validate the batch before importing', 'NOT_VALIDATED');
  if (!fingerprint || fingerprint !== job.fingerprint || batchFingerprint(job) !== job.fingerprint) throw httpError(409, 'Batch changed since validation; validate again', 'STALE_VALIDATION');
  const files = job.files.map(file => {
    if (!IMPORTABLE.includes(file.status) || file.counts.valid === 0) return file;
    // Failed files restart from row 0; idempotent writes make re-sent rows no-ops.
    return file.status === 'failed' ? { ...file, status: 'queued_import', checkpoint: { nextRow: 0 }, counts: { ...file.counts, imported: 0, failed: 0 } } : { ...file, status: 'queued_import' };
  });
  if (!files.some(file => file.status === 'queued_import')) throw httpError(400, 'No valid questions to import');
  const updated = await repo.updateJob(id, createdBy, { status: job.status, updatedAt: job.updatedAt }, {
    $set: { files, status: 'importing', phase: 'import', lease: null, attempts: 0, error: null, importStartedAt: new Date(), progress: { phase: 'import', fileIndex: 0 }, ...touch() },
  });
  if (!updated) throw httpError(409, 'Batch changed concurrently; refresh and try again');
  return updated;
}

export async function previewFile(id, createdBy, fileId, limit = 20) {
  const job = await requireJob(id, createdBy);
  const file = job.files.find(entry => entry.id === fileId);
  if (!file) throw httpError(404, 'File not found in batch');
  const rows = [];
  const stream = openStagedStream(file.gridFsId);
  try {
    for await (const row of parseRecords(stream, file.format)) {
      rows.push(row);
      if (rows.length >= limit) break;
    }
  } catch (error) {
    if (!(error instanceof ImportFormatError)) throw error;
    return { file: { id: file.id, name: file.name, format: file.format }, rows, error: error.message };
  } finally { stream.destroy(); }
  return { file: { id: file.id, name: file.name, format: file.format }, rows };
}

const csvCell = value => { const text = String(value ?? ''); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; };
export async function writeIssueReport(id, createdBy, fileId, res) {
  const job = await requireJob(id, createdBy);
  const file = job.files.find(entry => entry.id === fileId);
  if (!file) throw httpError(404, 'File not found in batch');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${file.name.replace(/[^\w.-]+/g, '_')}-issues.csv"`);
  res.write('line,phase,severity,code,message\n');
  for await (const issue of repo.issuesCursor(job._id, fileId)) {
    res.write(`${[issue.line, issue.phase, issue.severity, issue.code, issue.message].map(csvCell).join(',')}\n`);
  }
  res.end();
}

export async function discardJob(id, createdBy) {
  const job = await requireJob(id, createdBy);
  if (job.phase) throw httpError(409, 'Batch is running and cannot be discarded right now');
  await purgeJob(job);
  return true;
}

export async function purgeJob(job) {
  await Promise.all(job.files.map(file => deleteStagedFile(file.gridFsId)));
  await repo.clearIssues(job._id);
  await repo.jobsCollection().deleteOne({ _id: job._id });
}

export const completedExpiry = () => new Date(Date.now() + DONE_TTL_MS);
