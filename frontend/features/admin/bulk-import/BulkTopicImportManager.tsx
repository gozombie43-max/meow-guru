"use client";
import { Fragment, useMemo, useRef, useState, type DragEvent } from 'react';
import { useExamMode } from '@/context/ExamModeContext';
import type { ExamMode } from '@/lib/exam-mode';
import { importApi } from './api';
import { ACCEPTED_EXTENSIONS, MAX_FILES, useImportBatch } from './useImportBatch';
import type { CheckState, FileStatus, ImportFile, ImportJob, PreviewRow } from './types';
import styles from './BulkTopicImportManager.module.css';

const STATUS_META: Record<FileStatus, { label: string; tone: 'neutral' | 'info' | 'ok' | 'warn' | 'err' }> = {
  pending: { label: 'Not validated', tone: 'neutral' },
  queued: { label: 'Queued', tone: 'info' },
  validating: { label: 'Validating…', tone: 'info' },
  ready: { label: 'Ready', tone: 'ok' },
  needs_review: { label: 'Needs review', tone: 'warn' },
  invalid: { label: 'Invalid', tone: 'err' },
  queued_import: { label: 'Queued for import', tone: 'info' },
  importing: { label: 'Importing…', tone: 'info' },
  imported: { label: 'Imported', tone: 'ok' },
  failed: { label: 'Failed', tone: 'err' },
};
const tintIndex = (value: string) => [...value].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5;
const formatBytes = (bytes: number) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const plural = (count: number, word: string) => `${count.toLocaleString()} ${word}${count === 1 ? '' : 's'}`;

function aggregate(job: ImportJob | null, key: 'format' | 'schema' | 'duplicates'): { state: CheckState | 'running'; text: string } {
  const files = job?.files || [];
  if (!files.length) return { state: 'pending', text: 'No files' };
  if (job?.status === 'validating' && files.some(file => file.checks[key] === 'pending')) return { state: 'running', text: key === 'duplicates' ? 'Checking database' : 'Checking…' };
  const done = files.filter(file => file.checks[key] !== 'pending');
  if (!done.length) return { state: 'pending', text: 'Not run' };
  const pass = done.filter(file => file.checks[key] === 'pass').length;
  const warn = done.filter(file => file.checks[key] === 'warn').length;
  const fail = done.filter(file => file.checks[key] === 'fail').length;
  if (fail) return { state: 'fail', text: `${pass} passed / ${fail} failed` };
  if (warn) return { state: 'warn', text: `${pass} passed / ${warn} warning${warn === 1 ? '' : 's'}` };
  return { state: 'pass', text: `${pass} / ${files.length} passed` };
}

export default function BulkTopicImportManager() {
  const { mode } = useExamMode();
  return <BulkTopicImportView key={mode} mode={mode} />;
}

function BulkTopicImportView({ mode }: { mode: ExamMode }) {
  const batch = useImportBatch(mode);
  const { job, catalog, busy } = batch;
  const { mappingProblem } = catalog;
  const { mappingOf } = batch;
  const files = useMemo(() => job?.files ?? [], [job?.files]);
  const locked = Boolean(job && !['draft', 'validated'].includes(job.status));
  const [dragging, setDragging] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ file: ImportFile; rows: PreviewRow[]; error?: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<string | null>(null);

  const mappingIssues = useMemo(
    () => Object.fromEntries(files.map(file => [file.id, mappingProblem(mappingOf(file))])),
    [files, mappingProblem, mappingOf],
  );
  const mappedCount = files.filter(file => !mappingIssues[file.id]).length;
  const importable = files.filter(file => ['ready', 'needs_review', 'failed'].includes(file.status) && file.counts.valid > 0);
  const importTotal = importable.reduce((sum, file) => sum + file.counts.valid, 0);
  const canValidate = files.length > 0 && !locked && !busy && mappedCount === files.length;
  const retry = job?.status === 'partially_failed';
  const canImport = Boolean(job && (job.status === 'validated' || retry) && !batch.dirty && !busy && importTotal > 0);
  const slotsLeft = MAX_FILES - files.length;

  const checks = [
    { title: 'File format', hint: 'All files must be .ndjson, .jsonl or .json', ...aggregate(job, 'format') },
    { title: 'Schema validation', hint: 'Validate question structure, options and answers', ...aggregate(job, 'schema') },
    { title: 'Duplicate check', hint: 'Check for duplicate questions in file, batch and database', ...aggregate(job, 'duplicates') },
    {
      title: 'Target mapping',
      hint: 'Verify subject, topic and quiz mapping',
      state: (files.length === 0 ? 'pending' : mappedCount === files.length && !files.some(file => file.checks.mapping === 'fail') ? (files.some(file => file.checks.mapping === 'warn') ? 'warn' : 'pass') : 'fail') as CheckState,
      text: files.length ? `${mappedCount} / ${files.length} complete` : 'No files',
    },
  ];

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    if (!locked) void batch.addFiles(Array.from(event.dataTransfer.files));
  };
  const openPreview = async (file: ImportFile) => {
    if (!job) return;
    try { const result = await importApi.preview(job._id, file.id); setPreview({ file, ...result }); }
    catch (err) { setPreview({ file, rows: [], error: err instanceof Error ? err.message : String(err) }); }
  };
  const downloadReport = (file: ImportFile) => {
    if (job) void importApi.downloadReport(job._id, file.id, file.name).catch(err => alert(err.message));
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Bulk Question Import</h1>
          <p className={styles.subtitle}>Configure up to {MAX_FILES} topic files, validate everything, then import safely.</p>
        </div>
        <span className={styles.slotChip}>📄 {slotsLeft} of {MAX_FILES} file slots free</span>
      </header>

      {batch.resumable && !job && (
        <div className={styles.banner} data-tone="info">
          <span>You have an unfinished batch ({plural(batch.resumable.files.length, 'file')}, {batch.resumable.status.replace('_', ' ')}) from {new Date(batch.resumable.updatedAt).toLocaleString()}.</span>
          <span className={styles.bannerActions}>
            <button type="button" className={styles.btnSecondary} onClick={() => void batch.resume(batch.resumable!._id)}>Resume draft</button>
            <button type="button" className={styles.btnGhost} onClick={batch.startNew}>Start new</button>
          </span>
        </div>
      )}
      {batch.error && (
        <div className={styles.banner} data-tone="err">
          <span>{batch.error}</span>
          <button type="button" className={styles.btnGhost} onClick={batch.dismissError}>Dismiss</button>
        </div>
      )}
      {job?.error && <div className={styles.banner} data-tone="err"><span>{job.error}</span></div>}
      {batch.warnings.length > 0 && (
        <div className={styles.banner} data-tone="warn">
          <ul className={styles.warningList}>{batch.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
          <button type="button" className={styles.btnGhost} onClick={batch.dismissWarnings}>Dismiss</button>
        </div>
      )}
      {job?.status === 'completed' && (
        <div className={styles.banner} data-tone="ok">
          <span>Import complete — {plural(files.reduce((sum, file) => sum + file.counts.imported, 0), 'question')} written across {plural(files.filter(file => file.status === 'imported').length, 'file')}.</span>
          <button type="button" className={styles.btnSecondary} onClick={batch.startNew}>Start a new batch</button>
        </div>
      )}

      <div className={styles.grid}>
        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2 className={styles.cardTitle}><span aria-hidden>⤴</span> Import batch</h2>
            <button type="button" className={styles.btnPrimary} disabled={locked || slotsLeft <= 0 || Boolean(busy)} onClick={() => addInput.current?.click()}>＋ Add topic file</button>
          </div>
          <div className={styles.progressLabel}>{files.length} of {MAX_FILES} files configured</div>
          <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${(files.length / MAX_FILES) * 100}%` }} /></div>

          {files.length > 0 && (
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.batchTable}`}>
                <thead>
                  <tr><th>#</th><th>Filename</th><th>Subject</th><th>Topic</th><th>Quiz</th><th>Questions</th><th>Status</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  {files.map((file, index) => {
                    const mapping = mappingOf(file);
                    const topics = catalog.topicsFor(mapping.subject);
                    const chapters = catalog.chaptersFor(mapping.subject, mapping.topic);
                    const quizzes = catalog.quizzesFor(mapping.subject, mapping.topic);
                    const meta = STATUS_META[file.status] || STATUS_META.pending;
                    const showMappingHint = mappingIssues[file.id] && file.status === 'pending';
                    const importing = file.status === 'importing' || file.status === 'imported' || (file.status === 'failed' && file.counts.imported > 0);
                    return (
                      <Fragment key={file.id}>
                        <tr className={expanded === file.id ? styles.rowExpanded : undefined}>
                          <td className={styles.muted}>{index + 1}</td>
                          <td>
                            <div className={styles.fileCell} title={file.name}>
                              <span className={styles.fileIcon} aria-hidden>🗎</span>
                              {file.name}
                              <span className={styles.fileSub}>{formatBytes(file.size)} • {file.format.toUpperCase()}</span>
                            </div>
                          </td>
                          <td>
                            <select
                              className={styles.select}
                              data-tint={mapping.subject ? String(tintIndex(mapping.subject)) : undefined}
                              value={mapping.subject}
                              disabled={locked}
                              aria-label={`Subject for ${file.name}`}
                              onChange={event => batch.setMapping(file.id, { subject: event.target.value })}
                            >
                              <option value="">Subject…</option>
                              {catalog.subjects.map(subject => <option key={subject.value} value={subject.value}>{subject.label}</option>)}
                            </select>
                          </td>
                          <td>
                            <select
                              className={styles.select}
                              value={mapping.topic}
                              disabled={locked || !mapping.subject}
                              aria-label={`Topic for ${file.name}`}
                              onChange={event => batch.setMapping(file.id, { topic: event.target.value })}
                            >
                              <option value="">Topic…</option>
                              {topics.map(topic => <option key={topic.value} value={topic.value}>{topic.label}</option>)}
                            </select>
                            {chapters.length > 0 && (
                              <select
                                className={`${styles.select} ${styles.subSelect}`}
                                value={mapping.chapterSlug || ''}
                                disabled={locked}
                                aria-label={`Chapter for ${file.name}`}
                                onChange={event => {
                                  const chapter = chapters.find(entry => entry.slug === event.target.value);
                                  batch.setMapping(file.id, { chapterSlug: chapter?.slug || '', chapterTitle: chapter?.title || '' });
                                }}
                              >
                                <option value="">All chapters (from file)</option>
                                {chapters.map(chapter => <option key={chapter.slug} value={chapter.slug}>{chapter.rank}. {chapter.title}</option>)}
                              </select>
                            )}
                          </td>
                          <td>
                            <select
                              className={styles.select}
                              value={mapping.quizName}
                              disabled={locked || !mapping.topic}
                              aria-label={`Quiz for ${file.name}`}
                              onChange={event => batch.setMapping(file.id, { quizName: event.target.value })}
                            >
                              <option value="">Quiz…</option>
                              {quizzes.map(quiz => <option key={quiz} value={quiz}>{quiz}</option>)}
                            </select>
                          </td>
                          <td>
                            {file.counts.total ? (
                              <div>
                                <div className={styles.count}>{plural(file.counts.valid, 'question')}</div>
                                <div className={styles.muted}>
                                  of {file.counts.total.toLocaleString()} rows
                                  {file.counts.invalid > 0 && <> · <span className={styles.errText}>{file.counts.invalid} invalid</span></>}
                                  {file.counts.duplicate > 0 && <> · <span className={styles.warnText}>{file.counts.duplicate} dup</span></>}
                                </div>
                                {importing && (
                                  <div className={styles.miniTrack} title={`${file.counts.imported} imported`}>
                                    <div className={styles.miniFill} style={{ width: `${Math.min(100, (file.counts.imported / Math.max(1, file.counts.valid)) * 100)}%` }} />
                                  </div>
                                )}
                              </div>
                            ) : <span className={styles.muted}>—</span>}
                          </td>
                          <td>
                            <span className={styles.pill} data-tone={showMappingHint ? 'warn' : meta.tone}>{showMappingHint ? 'Needs mapping' : meta.label}</span>
                            {file.status === 'imported' || file.status === 'failed' ? (
                              <div className={styles.muted}>{file.counts.imported.toLocaleString()} written{file.counts.failed ? `, ${file.counts.failed} failed` : ''}</div>
                            ) : null}
                          </td>
                          <td>
                            <div className={styles.actions}>
                              <button type="button" className={styles.btnSmall} onClick={() => void openPreview(file)}>👁 Preview</button>
                              <button type="button" className={styles.btnSmall} disabled={locked} onClick={() => { replaceTarget.current = file.id; replaceInput.current?.click(); }}>⟳ Replace</button>
                              <button type="button" className={styles.btnDanger} disabled={locked} aria-label={`Remove ${file.name}`} onClick={() => { if (confirm(`Remove ${file.name} from this batch?`)) void batch.removeFile(file.id); }}>🗑</button>
                            </div>
                            <div className={styles.actions}>
                              {files.length > 1 && !locked && <button type="button" className={styles.linkBtn} onClick={() => batch.applyToAll(file.id)}>Apply mapping to all</button>}
                              {file.issueCount > 0 && <button type="button" className={styles.linkBtn} onClick={() => setExpanded(expanded === file.id ? null : file.id)}>{expanded === file.id ? 'Hide' : 'Show'} {plural(file.issueCount, 'issue')}</button>}
                            </div>
                          </td>
                        </tr>
                        {expanded === file.id && (
                          <tr className={styles.issueRow}>
                            <td colSpan={8}>
                              <strong>{file.name}</strong>{' '}
                              <span className={styles.muted}>— showing {Math.min(file.issues.length, file.issueCount)} of {plural(file.issueCount, 'issue')}</span>
                              <div className={styles.issueHead}>
                                <button type="button" className={styles.btnSmall} onClick={() => downloadReport(file)}>⬇ Download error report (CSV)</button>
                              </div>
                              <ul className={styles.issueList}>
                                {file.issues.map((issue, i) => (
                                  <li key={`${issue.line}-${issue.code}-${i}`} data-severity={issue.severity}>
                                    <span className={styles.issueLine}>{issue.line ? `Line ${issue.line}` : 'File'}</span>
                                    <span className={styles.issueCode}>{issue.code}</span>
                                    <span>{issue.message}</span>
                                  </li>
                                ))}
                              </ul>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!locked && slotsLeft > 0 && (
            <button
              type="button"
              className={styles.dropButton}
              data-active={dragging || undefined}
              disabled={Boolean(busy)}
              onDragOver={event => { event.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => addInput.current?.click()}
            >
              <span className={styles.dropIcon} aria-hidden>☁</span>
              <span><strong>{busy === 'upload' ? 'Uploading…' : 'Drop files here'}</strong> or <span className={styles.link}>browse</span></span>
              <span className={styles.muted}>Supports .ndjson, .jsonl, .json • up to 25 MB each • Add up to {slotsLeft} more file{slotsLeft === 1 ? '' : 's'}</span>
            </button>
          )}
          <input ref={addInput} aria-label="Add topic files" type="file" hidden multiple accept={ACCEPTED_EXTENSIONS.join(',')} onChange={event => { const list = Array.from(event.target.files || []); event.target.value = ''; if (list.length) void batch.addFiles(list); }} />
          <input ref={replaceInput} aria-label="Replace topic file" type="file" hidden accept={ACCEPTED_EXTENSIONS.join(',')} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file && replaceTarget.current) void batch.replaceFile(replaceTarget.current, file); }} />
        </section>

        <aside className={styles.card}>
          <div className={styles.cardHead}><h2 className={styles.cardTitle}><span aria-hidden>🛡</span> Batch validation</h2></div>
          <ol className={styles.steps}>
            {checks.map((check, index) => (
              <li key={check.title} className={styles.step}>
                <span className={styles.stepNum} data-state={check.state}>{index + 1}</span>
                <div className={styles.stepBody}>
                  <div className={styles.stepTitle}>{check.title}</div>
                  <div className={styles.muted}>{check.hint}</div>
                </div>
                <span className={styles.stepResult} data-state={check.state}>
                  {check.state === 'pass' ? '✓ ' : check.state === 'warn' ? '⚠ ' : check.state === 'fail' ? '✕ ' : check.state === 'running' ? '⟳ ' : ''}{check.text}
                </span>
              </li>
            ))}
          </ol>
          {job?.running && job.progress && (
            <div className={styles.runState}>
              {job.progress.phase === 'validate' ? 'Validating' : 'Importing'} file {job.progress.fileIndex + 1} of {files.length}: {files[job.progress.fileIndex]?.name}
            </div>
          )}
          <div className={styles.legend}><span data-tone="ok">Ready</span><span data-tone="warn">Warning</span><span data-tone="err">Error</span></div>
          <div className={styles.infoBox}>ⓘ Nothing is written to the database until you confirm the import. Invalid rows and duplicates are skipped; imports are idempotent and resume safely.</div>
          {job?.status === 'validated' && batch.dirty && <div className={styles.banner} data-tone="warn"><span>Mappings changed — validate again before importing.</span></div>}
        </aside>
      </div>

      <footer className={styles.actionBar}>
        <div className={styles.optionsWrap}>
          <button type="button" className={styles.btnGhost} onClick={() => setOptionsOpen(open => !open)} aria-expanded={optionsOpen}>⚙ Import options ▾</button>
          {optionsOpen && (
            <div className={styles.optionsMenu}>
              <div className={styles.muted}>Duplicates and invalid rows are always skipped. Rows with warnings are imported.</div>
              <button type="button" className={styles.menuItem} disabled={!job || job.running} onClick={() => { setOptionsOpen(false); if (confirm('Discard this batch and delete its staged files?')) void batch.discard(); }}>Discard batch</button>
              <button type="button" className={styles.menuItem} onClick={() => { setOptionsOpen(false); batch.startNew(); }}>Start a new batch</button>
            </div>
          )}
        </div>
        <div className={styles.actionGroup}>
          {batch.dirty && <span className={styles.muted}>Unsaved changes</span>}
          <button type="button" className={styles.btnSecondary} disabled={!job || locked || Boolean(busy) || !batch.dirty} onClick={() => void batch.saveDraft()}>{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
          <button type="button" className={styles.btnOutline} disabled={!canValidate} title={mappedCount < files.length ? 'Map every file to a subject, topic and quiz first' : undefined} onClick={() => void batch.validate()}>
            {job?.status === 'validating' ? 'Validating…' : 'Validate all files'}
          </button>
          <button type="button" className={styles.btnPrimary} disabled={!canImport} onClick={() => setConfirming(true)}>
            ⤴ {job?.status === 'importing' ? 'Importing…' : retry ? 'Retry failed files' : `Import ${importTotal.toLocaleString()} questions`}
          </button>
        </div>
      </footer>

      {preview && (
        <div className={styles.overlay}>
          <button type="button" className={styles.backdrop} aria-label="Close preview" onClick={() => setPreview(null)} />
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label={`Preview ${preview.file.name}`}>
            <div className={styles.dialogHead}><strong>Preview — {preview.file.name}</strong><button type="button" className={styles.btnGhost} onClick={() => setPreview(null)}>✕</button></div>
            {preview.error && <div className={styles.banner} data-tone="err">{preview.error}</div>}
            <div className={styles.previewList}>
              {preview.rows.map(row => (
                <div key={row.line} className={styles.previewRow}>
                  <span className={styles.issueLine}>Line {row.line}</span>
                  {row.error ? <span className={styles.errText}>{row.error}</span> : <pre>{JSON.stringify(row.record, null, 2).slice(0, 1200)}</pre>}
                </div>
              ))}
              {!preview.rows.length && !preview.error && <div className={styles.muted}>No rows.</div>}
            </div>
          </div>
        </div>
      )}

      {confirming && job && (
        <div className={styles.overlay}>
          <button type="button" className={styles.backdrop} aria-label="Close confirmation" onClick={() => setConfirming(false)} />
          <div className={styles.dialog} role="dialog" aria-modal="true" aria-label="Confirm import">
            <div className={styles.dialogHead}><strong>{retry ? 'Retry failed files?' : `Import ${importTotal.toLocaleString()} questions?`}</strong></div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th>File</th><th>Target</th><th>Import</th><th>Skipped</th></tr></thead>
                <tbody>
                  {importable.map(file => {
                    const mapping = mappingOf(file);
                    return (
                      <tr key={file.id}>
                        <td>{file.name}</td>
                        <td>{catalog.labelOf(mapping.subject)} › {mapping.chapterTitle || catalog.labelOf(mapping.subject, mapping.topic)} › {mapping.quizName}</td>
                        <td>{file.counts.valid.toLocaleString()}</td>
                        <td>{(file.counts.invalid + file.counts.duplicate).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {files.length > importable.length && <p className={styles.muted}>{plural(files.length - importable.length, 'file')} with no importable rows will be skipped.</p>}
            <p className={styles.muted}>Questions are written in chunks of 500 with progress saved after each chunk.</p>
            <div className={styles.dialogActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setConfirming(false)}>Cancel</button>
              <button type="button" className={styles.btnPrimary} onClick={() => { setConfirming(false); void batch.startImport(); }}>Confirm import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
