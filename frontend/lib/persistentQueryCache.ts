/**
 * Tiny localStorage-backed cache for small, public, rarely-changing query
 * results (e.g. question counts). Designed for stale-while-revalidate:
 * callers render the persisted value instantly and refresh in the background.
 *
 * - Versioned key prefix: bump CACHE_VERSION when the payload shape changes.
 * - Bounded: keeps at most MAX_ENTRIES (oldest evicted first).
 * - Expiring: entries older than MAX_AGE_MS are ignored and removed.
 * - Referentially stable reads (memory mirror), so it is safe to use as a
 *   `useSyncExternalStore` snapshot.
 * - Cross-tab sync via the `storage` event.
 * - Every storage access is guarded (private mode / quota / disabled storage).
 */

const CACHE_VERSION = 1;
const PREFIX = `meow:qcache:v${CACHE_VERSION}:`;
const INDEX_KEY = `${PREFIX}__index`;
const MAX_ENTRIES = 150;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface PersistedEntry<T> {
  data: T;
  savedAt: number;
}

const memory = new Map<string, PersistedEntry<unknown> | null>();
const listeners = new Set<() => void>();

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readIndex(store: Storage): string[] {
  try {
    const parsed = JSON.parse(store.getItem(INDEX_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function readPersisted<T>(key: string): PersistedEntry<T> | undefined {
  if (memory.has(key)) return (memory.get(key) ?? undefined) as PersistedEntry<T> | undefined;
  const store = storage();
  if (!store) return undefined;
  let entry: PersistedEntry<T> | null = null;
  try {
    const raw = store.getItem(PREFIX + key);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedEntry<T>;
      if (parsed && typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt < MAX_AGE_MS) {
        entry = parsed;
      } else {
        store.removeItem(PREFIX + key);
      }
    }
  } catch {
    entry = null;
  }
  memory.set(key, entry);
  return entry ?? undefined;
}

export function writePersisted<T>(key: string, data: T): void {
  const entry: PersistedEntry<T> = { data, savedAt: Date.now() };
  memory.set(key, entry);
  const store = storage();
  if (store) {
    try {
      const index = readIndex(store).filter((k) => k !== key);
      index.push(key);
      while (index.length > MAX_ENTRIES) {
        const evicted = index.shift();
        if (evicted) store.removeItem(PREFIX + evicted);
      }
      store.setItem(PREFIX + key, JSON.stringify(entry));
      store.setItem(INDEX_KEY, JSON.stringify(index));
    } catch {
      // Quota exceeded or storage disabled: the in-memory mirror still works.
    }
  }
  notify();
}

function onStorage(event: StorageEvent) {
  if (event.key === null) {
    memory.clear();
    notify();
  } else if (event.key.startsWith(PREFIX) && event.key !== INDEX_KEY) {
    memory.delete(event.key.slice(PREFIX.length));
    notify();
  }
}

export function subscribePersisted(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== "undefined") window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

export function clearPersisted(predicate?: (key: string) => boolean): void {
  const store = storage();
  if (store) {
    try {
      const index = readIndex(store);
      const remaining: string[] = [];
      for (const key of index) {
        if (!predicate || predicate(key)) {
          store.removeItem(PREFIX + key);
          memory.delete(key);
        } else {
          remaining.push(key);
        }
      }
      store.setItem(INDEX_KEY, JSON.stringify(remaining));
    } catch {
      // Ignore storage access errors.
    }
  }
  if (!predicate) {
    memory.clear();
  } else {
    for (const key of Array.from(memory.keys())) {
      if (predicate(key)) memory.delete(key);
    }
  }
  notify();
}

/** Test helper. */
export function __resetPersistedMemory() {
  memory.clear();
}
