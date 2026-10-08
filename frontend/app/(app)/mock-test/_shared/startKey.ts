export const mockStartStorageKey = (owner: string | undefined, exam: string, test: string) =>
  `mock-start:${JSON.stringify([owner ?? 'guest', exam, test])}`;

export function getMockStartKey(owner: string | undefined, exam: string, test: string) {
  const storageKey = mockStartStorageKey(owner, exam, test);
  let key = sessionStorage.getItem(storageKey);
  if (!key) {
    key = crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  }
  return key;
}
