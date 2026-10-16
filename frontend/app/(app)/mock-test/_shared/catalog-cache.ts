import { requestResponse } from '@/shared/api/request';
import { API_BASE } from '@/lib/api-base';
import type { MockTestSlot } from './exam-config';

export interface CatalogPage {
  slots: MockTestSlot[];
  metadata: { mockCount: number; pyqCount: number; tiers: string[] };
  total: number;
  nextOffset: number | null;
}
const TTL = 10 * 60 * 1000;
type Entry = { savedAt: number; data: CatalogPage };
const memory = new Map<string, Entry>();
const pending = new Map<string, Promise<CatalogPage>>();
const storageKey = (key: string) => `mock-catalog-v1:${key}`;

export function readCatalog(key: string): Entry | undefined {
  if (memory.has(key)) return memory.get(key);
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey(key)) || 'null') as Entry | null;
    if (saved && Number.isFinite(saved.savedAt) && Array.isArray(saved.data?.slots) && Array.isArray(saved.data?.metadata?.tiers)) {
      memory.set(key, saved);
      return saved;
    }
  } catch { /* Storage may be unavailable. The in-memory cache still works. */ }
}

export function fetchCatalog(key: string): Promise<CatalogPage> {
  const cached = readCatalog(key);
  if (cached && Date.now() - cached.savedAt < TTL) return Promise.resolve(cached.data);
  const running = pending.get(key);
  if (running) return running;
  const request = (async () => {
    const response = await requestResponse(`${API_BASE}${key}`, {}, { auth: 'none' });
    if (!response.ok) throw new Error('Could not load papers. Please try again.');
    const data: CatalogPage = await response.json();
    const entry = { data, savedAt: Date.now() };
    memory.set(key, entry);
    try { sessionStorage.setItem(storageKey(key), JSON.stringify(entry)); } catch { /* Optional persistence. */ }
    return data;
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
