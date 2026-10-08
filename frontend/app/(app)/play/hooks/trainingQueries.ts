import { useCallback } from 'react';
import useSWR, { unstable_serialize, useSWRConfig } from 'swr';
import api from '@/shared/api/client';
import { useAuth } from '@/context/AuthContext';
import { useAbortableResource } from '@/lib/use-abortable-resource';

export function useTrainingQuery<T>(resource: 'capabilities' | 'dashboard', exam?: string) {
  const { user, token, loading: authLoading } = useAuth();
  const ready = !authLoading && !!token && !!user?.id;
  const key = ready ? ['training', user.id, resource, exam ?? ''] : null;
  const serialized = key ? unstable_serialize(key) : null;
  const read = useAbortableResource(serialized);
  const { cache } = useSWRConfig();
  const ttl = resource === 'capabilities' ? 300_000 : 15_000;
  const { data, error, isLoading, mutate } = useSWR(key, async () => {
    const cached = key ? cache.get(unstable_serialize(key))?.data as { value: T; fetchedAt: number } | undefined : undefined;
    const deadlines = (cached?.value as { active?: { deadline: string }[] } | undefined)?.active ?? [];
    const expiry = Math.min(Infinity, ...deadlines.map(session => Date.parse(session.deadline)));
    if (cached && Date.now() - cached.fetchedAt < ttl && expiry > Date.now()) return cached;
    return read(async signal => {
      const { data: value } = await api.get<T>(`/api/training/${resource}`, { ...(exam ? { params: { exam } } : {}), signal });
      return { value, fetchedAt: Date.now() };
    });
  }, {
    revalidateOnMount: true,
    revalidateIfStale: false,
    // The owned read deduplicates in flight; timestamped data handles freshness.
    dedupingInterval: 0,
    shouldRetryOnError: false,
  });
  const retry = useCallback(() => { void mutate(); }, [mutate]);
  return { data: data?.value ?? null, error, loading: !ready || isLoading || (!data && !error), retry };
}

export function useInvalidateTrainingDashboard() {
  const { mutate } = useSWRConfig();
  return useCallback((owner: string | undefined) => {
    // The next hub/setup mount must read fresh data after a session write or entering a session.
    void mutate(key => Array.isArray(key) && key[0] === 'training' && key[1] === owner && key[2] === 'dashboard', undefined, { revalidate: true });
  }, [mutate]);
}
