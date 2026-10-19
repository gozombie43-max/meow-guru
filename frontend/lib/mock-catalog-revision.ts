const PREFIX = 'mock-catalog-revision:';
const EVENT = 'mock-catalog-changed';
const revisions = new Map<string, string>();

export function mockCatalogRevision(exam: string): string {
  const read = (key: string) => { try { return localStorage.getItem(`${PREFIX}${key}`) || revisions.get(key) || ''; } catch { return revisions.get(key) || ''; } };
  const global = read('*');
  return `${global ? `${global}|` : ''}${read(exam)}`;
}

/** Mark this exam stale after a successful admin write, including in other tabs. */
export function invalidateMockCatalog(exam: string) {
  const revision = `${Date.now()}-${Math.random()}`;
  revisions.set(exam, revision);
  try { localStorage.setItem(`${PREFIX}${exam}`, revision); } catch { /* Same-tab updates still work. */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: exam }));
}

export function subscribeMockCatalog(exam: string, refresh: () => void) {
  const onChange = (event: Event) => { if ([exam, '*'].includes((event as CustomEvent<string>).detail)) refresh(); };
  const onStorage = (event: StorageEvent) => {
    if ([`${PREFIX}${exam}`, `${PREFIX}*`].includes(event.key || '') && event.newValue !== event.oldValue) {
      revisions.set(event.key === `${PREFIX}*` ? '*' : exam, event.newValue || '');
      refresh();
    }
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}
