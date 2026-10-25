import { randomUUID } from 'node:crypto';
import { runtimeLog } from '../../infrastructure/runtimeLog.js';
import * as repo from '../../repositories/questionImportRepository.js';
import { checkDuplicates, createQuestionsBulk } from '../questions/questionWriteService.js';
import { openStagedStream } from './importStaging.js';
import { parseRecords, ImportFormatError } from './streamParser.js';
import { applyMapping, mappingErrors, recordFingerprint, validateMappedRecord, validateRecord } from './rowValidator.js';
import { IMPORT_LIMITS, completedExpiry, purgeJob } from './questionImportService.js';

const LEASE_MS = 120_000;
const HEARTBEAT_MS = 30_000;
const CHUNK = 500;
const INLINE_ISSUES = 200;
const MAX_ATTEMPTS = 5;
const workerId = `qi_${randomUUID().slice(0, 8)}`;

class LeaseLost extends Error {}

const emptyCounts = () => ({ total: 0, valid: 0, invalid: 0, duplicate: 0, warning: 0, imported: 0, failed: 0 });
const isTransient = error => !(error?.statusCode >= 400 && error?.statusCode < 500) && !(error instanceof ImportFormatError);

function fileSetter(job, owner, fileId) {
  return async fields => {
    const $set = { updatedAt: new Date() };
    for (const [key, value] of Object.entries(fields)) $set[`files.$[f].${key}`] = value;
    if (!await repo.updateOwned(job._id, owner, { $set }, [{ 'f.id': fileId }])) throw new LeaseLost('Import lease lost');
  };
}

// Buffers issue documents and writes them in batches; keeps the first N inline for the UI.
function issueSink(jobId, fileId, phase) {
  const inline = [];
  let pending = [], count = 0;
  return {
    inline, get count() { return count; },
    async add(line, issue, skip) {
      count++;
      const doc = { jobId, fileId, phase, line, severity: issue.severity, code: issue.code, message: String(issue.message).slice(0, 500), skip: Boolean(skip), expiresAt: completedExpiry() };
      if (inline.length < INLINE_ISSUES) inline.push({ line, severity: doc.severity, code: doc.code, message: doc.message });
      pending.push(doc);
      if (pending.length >= 1000) await this.flush();
    },
    async flush() { const docs = pending; pending = []; await repo.insertIssues(docs); },
  };
}

async function validateFile(job, file, batchSeen, ensureOwned) {
  const counts = emptyCounts();
  const checks = { format: 'pass', schema: 'pass', duplicates: 'pass', mapping: 'pass' };
  await repo.clearIssues(job._id, file.id);
  const issues = issueSink(job._id, file.id, 'validate');
  const mapErrors = mappingErrors(file.mapping);
  if (mapErrors.length) {
    checks.mapping = 'fail';
    for (const message of mapErrors) await issues.add(0, { severity: 'error', code: 'MAPPING', message });
  }
  const fileSeen = new Set();
  let pending = [];
  let mappingRowErrors = 0;
  const flushDuplicates = async () => {
    if (!pending.length) return;
    const batch = pending; pending = [];
    const duplicates = await checkDuplicates(batch.map(entry => entry.mapped), job.examMode);
    const byIndex = new Map(duplicates.map(entry => [entry.index, entry]));
    for (const [index, entry] of batch.entries()) {
      const duplicate = byIndex.get(index);
      if (duplicate) {
        counts.duplicate++;
        await issues.add(entry.line, { severity: 'warning', code: 'DB_DUPLICATE', message: `${duplicate.reason || 'Duplicate'} already in the question bank${duplicate.matchedId ? ` (ID: ${duplicate.matchedId})` : ''}` }, true);
      } else counts.valid++;
    }
    await ensureOwned();
  };

  const stream = openStagedStream(file.gridFsId);
  try {
    for await (const { line, record, error } of parseRecords(stream, file.format)) {
      counts.total++;
      if (counts.total > IMPORT_LIMITS.maxRowsPerFile) throw new ImportFormatError(`File exceeds ${IMPORT_LIMITS.maxRowsPerFile.toLocaleString()} rows`);
      if (error) { counts.invalid++; await issues.add(line, { severity: 'error', code: 'INVALID_JSON', message: error }, true); continue; }
      const rowIssues = validateRecord(record);
      let mapped = null;
      if (!rowIssues.some(issue => issue.severity === 'error') && !mapErrors.length) {
        mapped = applyMapping(record, file.mapping, job.examMode);
        const mappedIssues = validateMappedRecord(mapped, record, file.mapping, job.examMode);
        if (mappedIssues.length) mappingRowErrors++;
        rowIssues.push(...mappedIssues);
      }
      const errors = rowIssues.filter(issue => issue.severity === 'error');
      for (const issue of rowIssues) await issues.add(line, issue, errors.length > 0);
      if (errors.length) { counts.invalid++; continue; }
      if (mapErrors.length) continue; // unmapped: shape is OK but nothing is importable
      if (rowIssues.length) counts.warning++;
      const fingerprint = recordFingerprint(record);
      if (fileSeen.has(fingerprint) || batchSeen.has(fingerprint)) {
        counts.duplicate++;
        const code = fileSeen.has(fingerprint) ? 'IN_FILE_DUPLICATE' : 'BATCH_DUPLICATE';
        await issues.add(line, { severity: 'warning', code, message: code === 'IN_FILE_DUPLICATE' ? 'Duplicate of an earlier row in this file' : 'Duplicate of a row in an earlier file of this batch' }, true);
        continue;
      }
      fileSeen.add(fingerprint);
      pending.push({ line, mapped });
      if (pending.length >= CHUNK) await flushDuplicates();
    }
    await flushDuplicates();
  } catch (error) {
    if (!(error instanceof ImportFormatError)) throw error;
    checks.format = 'fail';
    await issues.add(0, { severity: 'error', code: 'FORMAT', message: error.message });
  } finally { stream.destroy(); }
  await issues.flush();
  for (const fingerprint of fileSeen) batchSeen.add(fingerprint);

  if (checks.format !== 'fail') {
    checks.schema = counts.invalid === 0 ? (counts.warning ? 'warn' : 'pass') : (counts.invalid < counts.total ? 'warn' : 'fail');
    if (counts.total === 0) checks.schema = 'fail';
  } else checks.schema = 'fail';
  checks.duplicates = mapErrors.length || checks.format === 'fail' ? 'pending' : (counts.duplicate ? 'warn' : 'pass');
  if (!mapErrors.length && mappingRowErrors) checks.mapping = mappingRowErrors >= counts.total ? 'fail' : 'warn';
  const status = checks.format === 'fail' || checks.mapping === 'fail' || counts.valid === 0 ? 'invalid'
    : (counts.invalid || counts.duplicate || counts.warning) ? 'needs_review' : 'ready';
  return { status, counts, checks, issues: issues.inline, issueCount: issues.count, checkpoint: { nextRow: 0 }, validatedAt: new Date() };
}

async function importFile(job, file, setFile, ensureOwned) {
  const skip = new Set(await repo.skippedRows(job._id, file.id));
  const counts = { ...file.counts };
  let nextRow = file.checkpoint?.nextRow || 0;
  if (nextRow === 0) { counts.imported = 0; counts.failed = 0; await repo.clearIssues(job._id, file.id, 'import'); }
  const issues = issueSink(job._id, file.id, 'import');
  let chunk = [];
  const flush = async endRow => {
    if (!chunk.length) { nextRow = endRow; return; }
    const rows = chunk; chunk = [];
    // importId is derived from the first row so a resumed chunk re-forms with the
    // same identity; createQuestionsBulk upserts by (importId:idx, hash).
    const importId = `${job._id}-${file.id}-${rows[0].line}`;
    try {
      const results = await createQuestionsBulk(rows.map(row => row.mapped), { importId, examMode: job.examMode });
      for (const [index, result] of results.entries()) {
        if (result?.status === 'fulfilled') counts.imported++;
        else { counts.failed++; await issues.add(rows[index].line, { severity: 'error', code: String(result?.reason?.code || 'WRITE_FAILED'), message: result?.reason?.message || 'Write failed' }); }
      }
    } catch (error) {
      if (isTransient(error)) throw error;
      counts.failed += rows.length;
      for (const row of rows) await issues.add(row.line, { severity: 'error', code: String(error.code || 'WRITE_REJECTED'), message: error.message });
    }
    await issues.flush();
    nextRow = endRow;
    await ensureOwned();
    await setFile({ counts, checkpoint: { nextRow } });
  };
  const stream = openStagedStream(file.gridFsId);
  let lastLine = nextRow;
  try {
    for await (const { line, record, error } of parseRecords(stream, file.format)) {
      lastLine = line;
      if (line < nextRow || error || skip.has(line)) continue;
      chunk.push({ line, mapped: applyMapping(record, file.mapping, job.examMode) });
      if (chunk.length >= CHUNK) await flush(line + 1);
    }
    await flush(lastLine + 1);
  } finally { stream.destroy(); }
  return { counts, status: counts.failed ? 'failed' : 'imported', checkpoint: { nextRow }, issueCount: (file.issueCount || 0) + issues.count, importedAt: new Date() };
}

export async function processQuestionImportJob() {
  const job = await repo.claimJob(workerId, LEASE_MS);
  if (!job) { await purgeExpired(); return null; }
  let owned = true;
  const heartbeat = setInterval(() => { void repo.renewLease(job._id, workerId, LEASE_MS).then(ok => { owned = ok; }).catch(() => { owned = false; }); }, HEARTBEAT_MS);
  heartbeat.unref?.();
  const ensureOwned = async () => { if (!owned) throw new LeaseLost('Import lease lost'); };
  try {
    if (job.phase === 'validate') {
      const batchSeen = new Set();
      for (const [index, file] of job.files.entries()) {
        const setFile = fileSetter(job, workerId, file.id);
        await setFile({ status: 'validating' });
        await repo.updateOwned(job._id, workerId, { $set: { progress: { phase: 'validate', fileIndex: index } } });
        await setFile(await validateFile(job, file, batchSeen, ensureOwned));
      }
      await repo.updateOwned(job._id, workerId, { $set: { status: 'validated', phase: null, lease: null, validatedAt: new Date(), updatedAt: new Date(), progress: null } });
      return { id: job._id, status: 'validated' };
    }
    for (const [index, file] of job.files.entries()) {
      if (!['queued_import', 'importing'].includes(file.status)) continue;
      const setFile = fileSetter(job, workerId, file.id);
      await setFile({ status: 'importing' });
      await repo.updateOwned(job._id, workerId, { $set: { progress: { phase: 'import', fileIndex: index } } });
      await setFile(await importFile(job, file, setFile, ensureOwned));
    }
    const latest = await repo.findJobById(job._id);
    const failed = latest.files.some(file => file.status === 'failed');
    await repo.updateOwned(job._id, workerId, { $set: { status: failed ? 'partially_failed' : 'completed', phase: null, lease: null, completedAt: new Date(), updatedAt: new Date(), expiresAt: completedExpiry(), progress: null } });
    return { id: job._id, status: failed ? 'partially_failed' : 'completed' };
  } catch (error) {
    if (error instanceof LeaseLost) return { id: job._id, status: 'lease-lost' };
    const retry = isTransient(error) && job.attempts < MAX_ATTEMPTS;
    const message = String(error?.message || error).slice(0, 300);
    if (retry) {
      // Release with backoff; the next claim resumes from the stored checkpoints.
      await repo.updateOwned(job._id, workerId, { $set: { lease: { owner: null, until: new Date(Date.now() + 2000 * 2 ** job.attempts) }, error: message, updatedAt: new Date() } });
    } else if (job.phase === 'validate') {
      await repo.updateOwned(job._id, workerId, { $set: { status: 'draft', phase: null, lease: null, fingerprint: null, error: `Validation failed: ${message}`, updatedAt: new Date() } });
    } else {
      await repo.updateOwned(job._id, workerId, { $set: { 'files.$[f].status': 'failed', status: 'partially_failed', phase: null, lease: null, error: `Import stopped: ${message}`, updatedAt: new Date() } }, [{ 'f.status': { $in: ['queued_import', 'importing'] } }]);
    }
    return { id: job._id, status: retry ? 'retrying' : 'failed', error: message };
  } finally { clearInterval(heartbeat); }
}

let lastPurge = 0;
async function purgeExpired() {
  if (Date.now() - lastPurge < 10 * 60_000) return;
  lastPurge = Date.now();
  for (const job of await repo.findExpiredJobs()) await purgeJob(job).catch(error => runtimeLog.error('Question import purge:', error.message));
}

let timer;
let tickFn;
const running = new Set();
export function startQuestionImportWorker() {
  if (timer) return;
  tickFn = () => {
    if (running.size) return; // one job at a time per process keeps memory bounded
    const work = processQuestionImportJob()
      .then(result => { if (result?.error) runtimeLog.error('Question import job:', result.id, result.error); })
      .catch(error => runtimeLog.error('Question import worker:', error.message))
      .finally(() => { running.delete(work); });
    running.add(work);
  };
  timer = setInterval(tickFn, 3000);
  timer.unref?.();
  tickFn();
}
export function nudgeQuestionImportWorker() { if (timer && tickFn) tickFn(); }
export function stopQuestionImportWorker() { clearInterval(timer); timer = null; tickFn = null; }
export async function waitForQuestionImportWorkerIdle(timeout = 12000) {
  if (!running.size) return true;
  let timeoutId;
  try { return await Promise.race([Promise.all([...running]).then(() => true), new Promise(resolve => { timeoutId = setTimeout(() => resolve(false), timeout); })]); }
  finally { clearTimeout(timeoutId); }
}
