import { useMemo } from 'react';
import useSWR from 'swr';
import { fetchWithRetry } from '@/lib/api/http';
import { API_BASE } from '@/lib/api-base';

interface QuestionsMeta {
  total: number;
  exams: string[];
  concepts: string[];
  letters: Record<string, number>;
  conceptGroups?: { id: string; label: string; description: string; concepts: string[] }[];
  groupingStatus?: 'ready' | 'processing' | 'failed' | 'empty';
}

const fetcher = async (url: string): Promise<QuestionsMeta> => {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error('Failed to fetch questions meta');
  return res.json();
};

const EMPTY_META: QuestionsMeta = {
  total: 0,
  exams: [],
  concepts: [],
  letters: {},
};

export function useQuestionsMeta(params: {
  topic?: string;
  subject?: string;
  mode?: string;
  enabled?: boolean;
}) {
  const query = new URLSearchParams();
  if (params.topic) query.set('topic', params.topic);
  if (params.subject) query.set('subject', params.subject);
  if (params.mode) query.set('mode', params.mode);

  const hasFilter = Boolean(params.topic || params.subject);
  const url = params.enabled === false || !hasFilter
    ? null
    : `${API_BASE}/api/questions/meta?${query.toString()}`;

  const { data, error, isLoading, mutate } = useSWR<QuestionsMeta>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: true,
    refreshInterval: (data) => data?.groupingStatus === 'processing' ? 10000 : 0,
    shouldRetryOnError: true,
    errorRetryCount: 2,
    errorRetryInterval: 1500,
    dedupingInterval: 10000, // Reuse cached UI; check saved metadata on later visits.
  });

  return useMemo(() => ({
    meta: data ?? EMPTY_META,
    isLoading,
    isError: error,
    mutate,
  }), [data, isLoading, error, mutate]);
}
