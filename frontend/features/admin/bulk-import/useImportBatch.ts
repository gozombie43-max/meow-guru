"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAdminExamCatalog } from '@/lib/admin-exam-mode';
import { getGeneralAwarenessTopicGroup } from '@/lib/general-awareness-topic-groups';
import { JAM_SUBJECT, type ExamMode } from '@/lib/exam-mode';
import { importApi, ImportApiError } from './api';
import type { FileMapping, ImportFile, ImportJob, ImportJobSummary } from './types';

export const MAX_FILES = 10;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const ACCEPTED_EXTENSIONS = ['.ndjson', '.jsonl', '.json'];
const EMPTY_MAPPING: FileMapping = { subject: '', topic: '', quizName: '', chapterSlug: '', chapterTitle: '' };

export function useImportCatalog(mode: ExamMode) {
  const catalog = useMemo(() => getAdminExamCatalog(mode), [mode]);
  const tree = catalog.quizTree;
  const subjects = useMemo(() => Object.entries(tree).map(([value, entry]) => ({ value, label: entry.label })), [tree]);
  const topicsFor = useCallback((subject: string) => Object.entries(tree[subject]?.topics || {}).map(([value, entry]) => ({ value, label: entry.label })), [tree]);
  const quizzesFor = useCallback((subject: string, topic: string) => tree[subject]?.topics[topic]?.quizzes || [], [tree]);
  const chaptersFor = useCallback((subject: string, topic: string) => (subject === 'general-awareness' && topic ? getGeneralAwarenessTopicGroup(topic)?.topics || [] : []), []);
  const labelOf = useCallback((subject: string, topic?: string) => (topic ? tree[subject]?.topics[topic]?.label || topic : tree[subject]?.label || subject), [tree]);

  /** Client-side mapping validity against the exam catalog. Returns an error or null. */
  const mappingProblem = useCallback((mapping: FileMapping) => {
    if (!mapping.subject) return 'Select a subject';
    if (!tree[mapping.subject]) return 'Subject is not in this exam catalog';
    if (!mapping.topic) return 'Select a topic';
    if (!tree[mapping.subject].topics[mapping.topic]) return 'Topic does not belong to this subject';
    if (!mapping.quizName) return 'Select a quiz';
    if (!quizzesFor(mapping.subject, mapping.topic).includes(mapping.quizName)) return 'Quiz does not belong to this topic';
    return null;
  }, [tree, quizzesFor]);

  const defaultMapping = useCallback((): FileMapping => ({ ...EMPTY_MAPPING, subject: mode === 'iit-jam' ? JAM_SUBJECT : '' }), [mode]);
  return { mode, subjects, topicsFor, quizzesFor, chaptersFor, labelOf, mappingProblem, defaultMapping };
}

const sameMapping = (a: FileMapping, b: FileMapping) =>
  a.subject === b.subject && a.topic === b.topic && a.quizName === b.quizName && (a.chapterSlug || '') === (b.chapterSlug || '');

export function useImportBatch(mode: ExamMode) {
  const catalog = useImportCatalog(mode);
  const [job, setJobState] = useState<ImportJob | null>(null);
  const [edits, setEdits] = useState<Record<string, FileMapping>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resumable, setResumable] = useState<ImportJobSummary | null>(null);
  const jobRef = useRef<ImportJob | null>(null);

  const setJob = useCallback((next: ImportJob | null) => {
    jobRef.current = next;
    setJobState(next);
  }, []);

  const mappingOf = useCallback((file: ImportFile): FileMapping => edits[file.id] || { ...EMPTY_MAPPING, ...file.mapping }, [edits]);
  const dirtyIds = useMemo(() => (job?.files || []).filter(file => edits[file.id] && !sameMapping(edits[file.id], { ...EMPTY_MAPPING, ...file.mapping })).map(file => file.id), [job, edits]);
  const dirty = dirtyIds.length > 0;

  const accept = useCallback((next: ImportJob, extraWarnings?: string[]) => {
    setJob(next);
    // Drop edits that the server now reflects.
    setEdits(old => Object.fromEntries(Object.entries(old).filter(([id, mapping]) => {
      const file = next.files.find(entry => entry.id === id);
      return file && !sameMapping(mapping, { ...EMPTY_MAPPING, ...file.mapping });
    })));
    if (extraWarnings) setWarnings(extraWarnings);
  }, [setJob]);

  const run = useCallback(async <T,>(label: string, work: () => Promise<T>) => {
    setBusy(label);
    setError(null);
    try { return await work(); }
    catch (err) { setError(err instanceof ImportApiError || err instanceof Error ? err.message : String(err)); return undefined; }
    finally { setBusy(null); }
  }, []);

  // Offer to resume the newest unfinished batch for this exam mode.
  useEffect(() => {
    let cancelled = false;
    importApi.list().then(({ jobs }) => {
      if (cancelled) return;
      const candidate = jobs.find(entry => entry.examMode === mode && ['draft', 'validated', 'validating', 'importing', 'partially_failed'].includes(entry.status) && entry.files.length);
      setResumable(candidate || null);
    }).catch(() => { /* listing is best-effort */ });
    return () => { cancelled = true; };
  }, [mode]);

  // Poll while the worker is validating/importing.
  const activeJobId = job?._id;
  const isRunning = Boolean(job?.running);
  useEffect(() => {
    if (!activeJobId || !isRunning) return;
    const timer = setInterval(() => {
      importApi.get(activeJobId).then(({ job: next }) => {
        if (jobRef.current?._id !== activeJobId) return;
        setJob(next);
        if (!next.running && next.status !== 'validated' && next.status !== 'draft') void importApi.invalidateQuestions();
      }).catch(() => { /* transient; keep polling */ });
    }, 1500);
    return () => clearInterval(timer);
  }, [activeJobId, isRunning, setJob]);

  const resume = useCallback((id: string) => run('resume', async () => {
    const { job: loaded } = await importApi.get(id);
    accept(loaded, []);
    setResumable(null);
  }), [accept, run]);

  const ensureJob = useCallback(async () => {
    if (jobRef.current) return jobRef.current;
    const { job: created } = await importApi.create(mode);
    setJob(created);
    setResumable(null);
    return created;
  }, [mode, setJob]);

  const addFiles = useCallback((files: File[]) => run('upload', async () => {
    const current = jobRef.current;
    const slots = MAX_FILES - (current?.files.length || 0);
    const local: string[] = [];
    const accepted = files.filter(file => {
      const dot = file.name.lastIndexOf('.');
      const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : '';
      if (!ACCEPTED_EXTENSIONS.includes(ext)) { local.push(`${file.name}: unsupported file type`); return false; }
      if (file.size > MAX_FILE_BYTES) { local.push(`${file.name}: larger than 25 MB`); return false; }
      if (!file.size) { local.push(`${file.name}: empty file`); return false; }
      return true;
    });
    if (accepted.length > slots) local.push(`Only ${slots} file slot${slots === 1 ? '' : 's'} left — ${accepted.length - slots} file(s) were not added`);
    const batch = accepted.slice(0, Math.max(0, slots));
    if (!batch.length) { setWarnings(local); return; }
    const target = await ensureJob();
    // Unsaved mapping edits must be persisted first: uploading resets the batch to draft.
    if (dirtyIds.length) await importApi.saveMappings(target._id, dirtyIds.map(id => ({ id, mapping: edits[id] })));
    const { job: next, warnings: serverWarnings = [] } = await importApi.addFiles(target._id, batch, batch.map(() => catalog.defaultMapping()));
    accept(next, [...local, ...serverWarnings]);
  }), [accept, catalog, dirtyIds, edits, ensureJob, run]);

  const replaceFile = useCallback((fileId: string, file: File) => run('upload', async () => {
    if (!jobRef.current) return;
    const { job: next, warnings: serverWarnings = [] } = await importApi.replaceFile(jobRef.current._id, fileId, file);
    accept(next, serverWarnings);
  }), [accept, run]);

  const removeFile = useCallback((fileId: string) => run('remove', async () => {
    if (!jobRef.current) return;
    const { job: next } = await importApi.removeFile(jobRef.current._id, fileId);
    accept(next);
  }), [accept, run]);

  const setMapping = useCallback((fileId: string, patch: Partial<FileMapping>) => {
    setEdits(old => {
      const file = jobRef.current?.files.find(entry => entry.id === fileId);
      if (!file) return old;
      const base = old[fileId] || { ...EMPTY_MAPPING, ...file.mapping };
      const next = { ...base, ...patch };
      // Cascading resets: subject → topic/chapter/quiz, topic → chapter/quiz.
      if ('subject' in patch && patch.subject !== base.subject) Object.assign(next, { topic: '', quizName: '', chapterSlug: '', chapterTitle: '' });
      if ('topic' in patch && patch.topic !== base.topic) Object.assign(next, { quizName: '', chapterSlug: '', chapterTitle: '' });
      return { ...old, [fileId]: next };
    });
  }, []);

  const applyToAll = useCallback((sourceId: string) => {
    const files = jobRef.current?.files || [];
    const source = files.find(file => file.id === sourceId);
    if (!source) return;
    const mapping = edits[sourceId] || { ...EMPTY_MAPPING, ...source.mapping };
    setEdits(old => Object.fromEntries([...Object.entries(old), ...files.map(file => [file.id, { ...mapping }] as const)]));
  }, [edits]);

  const saveDraft = useCallback(() => run('save', async () => {
    const current = jobRef.current;
    if (!current) return;
    const { job: next } = await importApi.saveMappings(current._id, current.files.map(file => ({ id: file.id, mapping: mappingOf(file) })));
    accept(next);
  }), [accept, mappingOf, run]);

  const validate = useCallback(() => run('validate', async () => {
    const current = jobRef.current;
    if (!current) return;
    if (dirty) await importApi.saveMappings(current._id, current.files.map(file => ({ id: file.id, mapping: mappingOf(file) })));
    const { job: next } = await importApi.validate(current._id);
    accept(next, []);
  }), [accept, dirty, mappingOf, run]);

  const startImport = useCallback(() => run('import', async () => {
    const current = jobRef.current;
    if (!current?.fingerprint) return;
    const { job: next } = await importApi.import(current._id, current.fingerprint);
    accept(next);
  }), [accept, run]);

  const discard = useCallback(() => run('discard', async () => {
    const current = jobRef.current;
    if (current) await importApi.discard(current._id);
    setJob(null); setEdits({}); setWarnings([]);
  }), [run, setJob]);

  const startNew = useCallback(() => { setJob(null); setEdits({}); setWarnings([]); setError(null); setResumable(null); }, [setJob]);

  return {
    catalog, job, busy, error, warnings, resumable, dirty,
    mappingOf, setMapping, applyToAll, addFiles, replaceFile, removeFile, saveDraft, validate, startImport, discard, resume, startNew,
    dismissWarnings: () => setWarnings([]), dismissError: () => setError(null),
  };
}
