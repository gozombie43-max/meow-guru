const memoryStartKeys = new Map<string, string>();

export const mockStartStorageKey = (owner: string | undefined, exam: string, test: string) =>
  `mock-start:${JSON.stringify([owner ?? 'guest', exam, test])}`;

export function getMockStartKey(owner: string | undefined, exam: string, test: string) {
  const storageKey = mockStartStorageKey(owner, exam, test);
  try {
    let key = sessionStorage.getItem(storageKey);
    if (!key) {
      key = memoryStartKeys.get(storageKey) || crypto.randomUUID();
      sessionStorage.setItem(storageKey, key);
    }
    memoryStartKeys.set(storageKey, key);
    return key;
  } catch {
    let key = memoryStartKeys.get(storageKey);
    if (!key) {
      key = crypto.randomUUID();
      memoryStartKeys.set(storageKey, key);
    }
    return key;
  }
}

export function clearMockStartKey(owner: string | undefined, exam: string, test: string) {
  const storageKey = mockStartStorageKey(owner, exam, test);
  memoryStartKeys.delete(storageKey);
  try { sessionStorage.removeItem(storageKey); } catch { /* Storage may be unavailable. */ }
}
