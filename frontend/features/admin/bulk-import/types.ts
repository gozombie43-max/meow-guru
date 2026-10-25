export type FileStatus =
  | 'pending' | 'queued' | 'validating' | 'ready' | 'needs_review' | 'invalid'
  | 'queued_import' | 'importing' | 'imported' | 'failed';
export type JobStatus = 'draft' | 'validating' | 'validated' | 'importing' | 'completed' | 'partially_failed';
export type CheckState = 'pending' | 'pass' | 'warn' | 'fail';

export interface FileMapping {
  subject: string;
  topic: string;
  quizName: string;
  chapterSlug?: string;
  chapterTitle?: string;
}

export interface FileCounts { total: number; valid: number; invalid: number; duplicate: number; warning: number; imported: number; failed: number }
export interface FileIssue { line: number; severity: 'error' | 'warning'; code: string; message: string }

export interface ImportFile {
  id: string;
  name: string;
  size: number;
  format: 'ndjson' | 'json';
  sha256: string;
  mapping: FileMapping;
  status: FileStatus;
  counts: FileCounts;
  checks: { format: CheckState; schema: CheckState; duplicates: CheckState; mapping: CheckState };
  issues: FileIssue[];
  issueCount: number;
  checkpoint?: { nextRow: number };
}

export interface ImportJob {
  _id: string;
  examMode: 'ssc' | 'iit-jam';
  status: JobStatus;
  running: boolean;
  fingerprint: string | null;
  error?: string | null;
  files: ImportFile[];
  progress?: { phase: 'validate' | 'import'; fileIndex: number } | null;
  limits: { maxFiles: number; maxFileBytes: number; maxRowsPerFile: number };
  updatedAt: string;
}

export interface ImportJobSummary {
  _id: string;
  status: JobStatus;
  examMode: string;
  updatedAt: string;
  files: Pick<ImportFile, 'id' | 'name' | 'status' | 'counts'>[];
}

export interface PreviewRow { line: number; record?: Record<string, unknown>; error?: string }
