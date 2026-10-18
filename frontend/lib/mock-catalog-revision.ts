const PREFIX = 'mock-catalog-revision:';
const EVENT = 'mock-catalog-changed';
const revisions = new Map<string, string>();

export function mockCatalogRevision(exam: string): string {
  try { return localStorage.getItem(`${PREFIX}${exam}`) || revisions.get(exam) || ''; }
  catch { return revisions.get(exam) || ''; }
}

/** Mark this exam stale after a successful admin write, including in other tabs. */
export function invalidateMockCatalog(exam: string) {
  const revision = `${Date.now()}-${Math.random()}`;
  revisions.set(exam, revision);
  try { localStorage.setItem(`${PREFIX}${exam}`, revision); } catch { /* Same-tab updates still work. */ }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: exam }));
}

export function subscribeMockCatalog(exam: string, refresh: () => void) {
  const onChange = (event: Event) => { if ((event as CustomEvent<string>).detail === exam) refresh(); };
  const onStorage = (event: StorageEvent) => {
    if (event.key === `${PREFIX}${exam}` && event.newValue !== event.oldValue) {
      revisions.set(exam, event.newValue || '');
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
