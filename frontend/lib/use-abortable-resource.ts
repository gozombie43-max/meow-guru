'use client';
import { useCallback, useEffect, useMemo } from 'react';
import { useSWRConfig } from 'swr';
import { abortError } from '@/shared/api/policy';

type Scope = { owners: Map<string, number>; pending: Map<string, { controller: AbortController; promise: Promise<unknown> }> };
const scopes = new WeakMap<object, Scope>();

// SWR consumers share one request. Leaving one screen must not cancel a read
// still needed by another; effect replay/navigation can reacquire before abort.
export function useAbortableResource(resource: string | null) {
  const { cache } = useSWRConfig();
  const scope = useMemo(() => {
    let value = scopes.get(cache);
    if (!value) { value = { owners: new Map(), pending: new Map() }; scopes.set(cache, value); }
    return value;
  }, [cache]);
  useEffect(() => {
    if (!resource) return;
    scope.owners.set(resource, (scope.owners.get(resource) ?? 0) + 1);
    return () => {
      const count = (scope.owners.get(resource) ?? 1) - 1;
      if (count) scope.owners.set(resource, count); else scope.owners.delete(resource);
      queueMicrotask(() => {
        if (scope.owners.has(resource)) return;
        const pending = scope.pending.get(resource);
        scope.pending.delete(resource);
        pending?.controller.abort();
      });
    };
  }, [resource, scope]);
  return useCallback(<T,>(work: (signal: AbortSignal) => Promise<T>): Promise<T> => {
    if (!resource) return Promise.reject(abortError());
    let pending = scope.pending.get(resource);
    if (!pending) {
      const controller = new AbortController();
      const promise = Promise.resolve().then(() => {
        if (controller.signal.aborted) throw abortError();
        return work(controller.signal);
      }).then(value => {
        if (controller.signal.aborted) throw abortError();
        return value;
      }).finally(() => {
        if (scope.pending.get(resource)?.controller === controller) scope.pending.delete(resource);
      });
      pending = { controller, promise };
      scope.pending.set(resource, pending);
    }
    return pending.promise as Promise<T>;
  }, [resource, scope]);
}
