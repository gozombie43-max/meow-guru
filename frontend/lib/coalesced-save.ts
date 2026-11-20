function isAbortLikeError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; code?: unknown; kind?: unknown };
  return (
    candidate.name === 'AbortError'
    || candidate.name === 'CanceledError'
    || candidate.code === 'ERR_CANCELED'
    || candidate.kind === 'aborted'
  );
}

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
            try {
              await write(next);
              saved = next;
            } catch (error) {
              const isAbort = isAbortLikeError(error);
              if (isAbort || pending === undefined) {
                if (isAbort) pending = undefined;
                throw error;
              }
              // A newer snapshot arrived while the failed write was in flight:
              // continue draining the newer snapshot so it is never discarded.
            }
          }
        })().finally(() => { running = undefined; });
      }
      return running;
    },
  };
}
