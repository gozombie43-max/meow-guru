import { API_BASE } from '@/lib/api-base';
import { getAccessToken } from '@/shared/api/client';
import { requestResponse } from '@/shared/api/request';
import { invalidateQuestionQueries } from '@/features/quiz/api/questionWrites';
import type { FileMapping, ImportJob, ImportJobSummary, PreviewRow } from './types';

const BASE = `${API_BASE}/api/admin/question-imports`;

export class ImportApiError extends Error {
  constructor(message: string, public status: number, public code?: string) { super(message); }
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getAccessToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await requestResponse(`${BASE}${path}`, { ...init, headers }, { timeoutMs });
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* non-JSON error body */ }
  if (!response.ok) {
    const body = (data || {}) as { error?: string; code?: string };
    throw new ImportApiError(body.error || text || `Request failed (HTTP ${response.status})`, response.status, body.code);
  }
  return data as T;
}

type JobResponse = { job: ImportJob; warnings?: string[] };

export const importApi = {
  list: () => call<{ jobs: ImportJobSummary[] }>(''),
  create: (examMode: string) => call<JobResponse>('', { method: 'POST', body: JSON.stringify({ examMode }) }),
  get: (id: string) => call<JobResponse>(`/${id}`),
  saveMappings: (id: string, files: { id: string; mapping: FileMapping }[]) =>
    call<JobResponse>(`/${id}`, { method: 'PATCH', body: JSON.stringify({ files }) }),
  discard: (id: string) => call<void>(`/${id}`, { method: 'DELETE' }),
  addFiles: (id: string, files: File[], mappings: FileMapping[]) => {
    const form = new FormData();
    files.forEach(file => form.append('files', file, file.name));
    form.append('mappings', JSON.stringify(mappings));
    return call<JobResponse>(`/${id}/files`, { method: 'POST', body: form }, 180_000);
  },
  replaceFile: (id: string, fileId: string, file: File) => {
    const form = new FormData();
    form.append('file', file, file.name);
    return call<JobResponse>(`/${id}/files/${fileId}`, { method: 'PUT', body: form }, 180_000);
  },
  removeFile: (id: string, fileId: string) => call<JobResponse>(`/${id}/files/${fileId}`, { method: 'DELETE' }),
  preview: (id: string, fileId: string) => call<{ rows: PreviewRow[]; error?: string }>(`/${id}/files/${fileId}/preview`),
  validate: (id: string) => call<JobResponse>(`/${id}/validate`, { method: 'POST' }),
  import: (id: string, fingerprint: string) => call<JobResponse>(`/${id}/import`, { method: 'POST', body: JSON.stringify({ confirm: true, fingerprint }) }),
  async downloadReport(id: string, fileId: string, fileName: string) {
    const headers = new Headers();
    const token = getAccessToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
    const response = await requestResponse(`${BASE}/${id}/files/${fileId}/report`, { headers }, { timeoutMs: 120_000 });
    if (!response.ok) throw new ImportApiError(`Report download failed (HTTP ${response.status})`, response.status);
    const url = URL.createObjectURL(await response.blob());
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${fileName.replace(/[^\w.-]+/g, '_')}-issues.csv`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  },
  invalidateQuestions: () => invalidateQuestionQueries(),
};
