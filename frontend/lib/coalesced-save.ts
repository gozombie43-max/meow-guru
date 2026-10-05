/** One request in flight; waiting callers flush the latest unsent state. */
export function createCoalescedSave<T>(write: (snapshot: T) => Promise<void>, equal: (a: T, b: T) => boolean) {
  let saved: T | undefined;
  let pending: T | undefined;
  let running: Promise<void> | undefined;
  return {
    seed(snapshot: T) { saved = snapshot; },
    save(snapshot: T): Promise<void> {
      pending = snapshot;
      if (!running) {
        running = (async () => {
          while (pending !== undefined) {
            const next = pending;
            pending = undefined;
            if (saved !== undefined && equal(saved, next)) continue;
            await write(next);
            saved = next;
          }
        })().finally(() => { running = undefined; });
      }
      return running;
    },
  };
}
