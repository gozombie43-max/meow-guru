import { requestResponse } from '@/shared/api/request';
import { API_BASE } from '@/lib/api-base';
import { mockCatalogRevision } from '@/lib/mock-catalog-revision';
import type { MockTestSlot } from './exam-config';

export interface CatalogPage {
  slots: MockTestSlot[];
  metadata: { mockCount: number; pyqCount: number; tiers: string[]; years?: number[] };
  total: number;
  nextOffset: number | null;
}
const TTL = 10 * 60 * 1000;
type Entry = { savedAt: number; data: CatalogPage; revision?: string };
const memory = new Map<string, Entry>();
const pending = new Map<string, { revision: string; promise: Promise<CatalogPage> }>();
const storageKey = (key: string) => `mock-catalog-v4:${key}`;
const revisionFor = (key: string) => {
  const exam = key.match(/^\/api\/mocktest\/([^/?]+)\/slots(?:\?|$)/)?.[1];
  return exam ? mockCatalogRevision(decodeURIComponent(exam)) : '';
};

export function readCatalog(key: string): Entry | undefined {
  const revision = revisionFor(key);
  const cached = memory.get(key);
  if (cached && (cached.revision || '') === revision) return cached;
  memory.delete(key);
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(key)) || 'null') as Entry | null;
    if (saved && (saved.revision || '') === revision && Number.isFinite(saved.savedAt) && Array.isArray(saved.data?.slots) && Array.isArray(saved.data?.metadata?.tiers)) {
      memory.set(key, saved);
      return saved;
    }
  } catch { /* Storage may be unavailable. The in-memory cache still works. */ }
}

export function fetchCatalog(key: string): Promise<CatalogPage> {
  const cached = readCatalog(key);
  if (cached && Date.now() - cached.savedAt < TTL) return Promise.resolve(cached.data);
  const revision = revisionFor(key);
  const running = pending.get(key);
  if (running?.revision === revision) return running.promise;
  const request = (async () => {
    const response = await requestResponse(`${API_BASE}${key}`, { cache: 'no-store' }, { auth: 'none' });
    if (!response.ok) throw new Error('Could not load papers. Please try again.');
    const data: CatalogPage = await response.json();
    // An older in-flight response must not restore a title from before the save.
    if (revision !== revisionFor(key)) return fetchCatalog(key);
    const entry = { data, savedAt: Date.now(), revision };
    memory.set(key, entry);
    try { sessionStorage.setItem(storageKey(key), JSON.stringify(entry)); } catch { /* Optional persistence. */ }
    return data;
  })().finally(() => { if (pending.get(key)?.promise === request) pending.delete(key); });
  pending.set(key, { revision, promise: request });
  return request;
}
