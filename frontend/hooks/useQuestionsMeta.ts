import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import { fetchWithRetry } from '@/lib/api/http';
import { API_BASE } from '@/lib/api-base';
import { PUBLIC_QUESTION_QUERY } from '@/features/quiz/api/publicQuery';

interface QuestionsMeta {
  total: number;
  exams: string[];
  concepts: string[];
  letters: Record<string, number>;
  conceptGroups?: { id: string; label: string; description: string; concepts: string[] }[];
  groupingStatus?: 'ready' | 'processing' | 'failed' | 'empty';
  groupingFingerprint?: string;
}

type GroupingStatus = Pick<QuestionsMeta, 'groupingStatus' | 'groupingFingerprint' | 'conceptGroups'> & { metadataChanged?: boolean };

const fetcher = async (url: string): Promise<QuestionsMeta> => {
  const res = await fetchWithRetry(url, {}, { auth: 'none' });
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
    ...PUBLIC_QUESTION_QUERY,
    revalidateOnFocus: false,
    revalidateIfStale: true,
    refreshInterval: 0,
    shouldRetryOnError: true,
    errorRetryInterval: 10000,
    dedupingInterval: 10000, // Reuse cached UI; check saved metadata on later visits.
  });

  const fingerprint = url && data?.groupingStatus === 'processing' ? data.groupingFingerprint : undefined;
  const [pollFingerprint, setPollFingerprint] = useState<string>();
  useEffect(() => {
    if (!fingerprint) return;
    // Metadata already contains the initial status; avoid reading it again on mount.
    const timer = setTimeout(() => setPollFingerprint(fingerprint), 10000);
    return () => clearTimeout(timer);
  }, [fingerprint]);
  const statusUrl = fingerprint && pollFingerprint === fingerprint
    ? `${API_BASE}/api/questions/concept-groups/${encodeURIComponent(fingerprint)}`
    : null;
  const { data: grouping, error: groupingError } = useSWR<GroupingStatus>(statusUrl, fetcher, {
    ...PUBLIC_QUESTION_QUERY,
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    refreshInterval: value => value?.groupingStatus === 'processing' ? 10000 : 0,
    // SWR pauses interval polling after an error, so retry status reads too.
    shouldRetryOnError: true,
    errorRetryInterval: 10000,
    dedupingInterval: 10000,
  });

  useEffect(() => {
    if (grouping?.metadataChanged && grouping.groupingFingerprint === fingerprint) void mutate();
  }, [grouping, fingerprint, mutate]);

  return useMemo(() => ({
    meta: data && grouping?.groupingFingerprint === data.groupingFingerprint ? { ...data, ...grouping } : data ?? EMPTY_META,
    isLoading,
    isError: error || groupingError,
    mutate,
  }), [data, grouping, isLoading, error, groupingError, mutate]);
}
