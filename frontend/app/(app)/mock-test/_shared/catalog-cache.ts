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
const MAX_STORAGE_ENTRIES = 24;
const STORAGE_PREFIX = 'mock-catalog-v4:';
type Entry = { savedAt: number; data: CatalogPage; revision?: string };
const memory = new Map<string, Entry>();
const pending = new Map<string, { revision: string; promise: Promise<CatalogPage> }>();
const storageKey = (key: string) => `${STORAGE_PREFIX}${key}`;
const revisionFor = (key: string) => {
  const exam = key.match(/^\/api\/mocktest\/([^/?]+)\/slots(?:\?|$)/)?.[1];
  return exam ? mockCatalogRevision(decodeURIComponent(exam)) : '';
};

function pruneSessionStorage() {
  try {
    const entries: Array<{ k: string; savedAt: number }> = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (!k || !k.startsWith(STORAGE_PREFIX)) continue;
      try {
        const parsed = JSON.parse(sessionStorage.getItem(k) || 'null') as Entry | null;
        entries.push({ k, savedAt: Number(parsed?.savedAt) || 0 });
      } catch {
        entries.push({ k, savedAt: 0 });
      }
    }
    if (entries.length <= MAX_STORAGE_ENTRIES) return;
    entries.sort((a, b) => a.savedAt - b.savedAt);
    for (const stale of entries.slice(0, entries.length - MAX_STORAGE_ENTRIES)) {
      sessionStorage.removeItem(stale.k);
    }
  } catch { /* Optional storage hygiene. */ }
}

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

export function fetchCatalog(key: string, loader?: () => Promise<CatalogPage>): Promise<CatalogPage> {
  const cached = readCatalog(key);
  if (cached && Date.now() - cached.savedAt < TTL) return Promise.resolve(cached.data);
  const revision = revisionFor(key);
  const running = pending.get(key);
  if (running?.revision === revision) return running.promise;
  const request = (async () => {
    let data: CatalogPage;
    if (typeof loader === 'function') {
      data = await loader();
    } else {
      const response = await requestResponse(`${API_BASE}${key}`, { cache: 'no-store' }, { auth: 'none' });
      if (!response.ok) throw new Error('Could not load papers. Please try again.');
      data = await response.json();
    }
    // An older in-flight response must not restore a title from before the save.
    if (revision !== revisionFor(key)) return fetchCatalog(key, typeof loader === 'function' ? loader : undefined);
    const entry = { data, savedAt: Date.now(), revision };
    memory.set(key, entry);
    try {
      sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
      pruneSessionStorage();
    } catch { /* Optional persistence. */ }
    return data;
  })().finally(() => { if (pending.get(key)?.promise === request) pending.delete(key); });
  pending.set(key, { revision, promise: request });
  return request;
}
