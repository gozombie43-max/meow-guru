import { API_BASE } from '@/lib/api-base';
import { mockCatalogRevision } from '@/lib/mock-catalog-revision';
import { requestResponse } from '@/shared/api/request';

export type ExamPaperCounts = { examSlug: string; mockCount: number; pyqCount: number; total: number; updatedAt: string };
type Entry = { savedAt: number; revision: string; exams: ExamPaperCounts[] };
const STORAGE = 'mock-catalog-summary-v1';
const TTL = 10 * 60 * 1000;
let cached: Entry | null = null;
let pending: { revision: string; promise: Promise<ExamPaperCounts[]> } | null = null;
const revisionFor = (exams: string[]) => exams.map(exam => `${exam}:${mockCatalogRevision(exam)}`).join('|');

export function fetchCatalogSummary(exams: string[]): Promise<ExamPaperCounts[]> {
  const revision = revisionFor(exams);
  if (!cached) {
    try { cached = JSON.parse(sessionStorage.getItem(STORAGE) || 'null') as Entry | null; } catch { /* Optional storage. */ }
  }
  if (cached && cached.revision === revision && Date.now() - cached.savedAt < TTL && Array.isArray(cached.exams)) return Promise.resolve(cached.exams);
  if (pending?.revision === revision) return pending.promise;
  const promise = (async () => {
    const response = await requestResponse(`${API_BASE}/api/mocktest/catalog-metadata`, {}, { auth: 'none' });
    if (!response.ok) throw new Error('Paper counts unavailable. Please retry.');
    const data = await response.json() as { exams: ExamPaperCounts[] };
    if (!Array.isArray(data.exams) || data.exams.some(exam => typeof exam.examSlug !== 'string' || !Number.isSafeInteger(exam.total) || exam.total < 0 || !Number.isSafeInteger(exam.mockCount) || !Number.isSafeInteger(exam.pyqCount) || exam.mockCount < 0 || exam.pyqCount < 0 || exam.total !== exam.mockCount + exam.pyqCount)) throw new Error('Invalid paper count metadata. Please retry.');
    if (revision !== revisionFor(exams)) return fetchCatalogSummary(exams);
    cached = { revision, savedAt: Date.now(), exams: data.exams };
    try { sessionStorage.setItem(STORAGE, JSON.stringify(cached)); } catch { /* Memory cache remains available. */ }
    return data.exams;
  })().finally(() => { if (pending?.promise === promise) pending = null; });
  pending = { revision, promise };
  return promise;
}
