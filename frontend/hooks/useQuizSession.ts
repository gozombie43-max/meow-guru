import { useCallback, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetchWithRetry } from '@/lib/api/http';
import { API_BASE } from '@/lib/api-base';
import type { Question } from '@/lib/api/questions';

interface SessionResponse {
  questions: Question[];
  nextCursor: string | null;
  hasMore: boolean;
}

const fetcher = async (url: string): Promise<SessionResponse> => {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error('Failed to fetch quiz session');
  return res.json();
};

export function useQuizSession(params: {
  subject: string;
  topic: string;
  mode?: string;
  limit?: number;
  letter?: string;
  enabled?: boolean;
}) {
  const {
    subject,
    topic,
    mode,
    limit = 50,
    letter,
    enabled = true,
  } = params;

  const [extraQuestions, setExtraQuestions] = useState<Question[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const cursorRef = useRef<string | null>(null);

  const query = new URLSearchParams();
  if (subject) query.set('subject', subject);
  if (topic) query.set('topic', topic);
  if (mode) query.set('mode', mode);
  if (letter) query.set('letter', letter);
  query.set('limit', String(limit));

  const url = enabled ? `${API_BASE}/api/questions/session?${query.toString()}` : null;

  const { data, error, isLoading, mutate } = useSWR<SessionResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    dedupingInterval: 60000,
    onSuccess: (res) => {
      cursorRef.current = res.nextCursor;
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setExtraQuestions([]);
    },
  });

  const fetchMore = useCallback(async () => {
    if (!cursorRef.current || isFetchingMore) return;

    setIsFetchingMore(true);
    try {
      const moreQuery = new URLSearchParams(query);
      moreQuery.set('cursor', cursorRef.current);
      const moreUrl = `${API_BASE}/api/questions/session?${moreQuery.toString()}`;
      const res = await fetcher(moreUrl);

      cursorRef.current = res.nextCursor;
      setNextCursor(res.nextCursor);
      setHasMore(res.hasMore);
      setExtraQuestions((prev) => [...prev, ...res.questions]);
    } catch {
      // Best-effort fetch-more
    } finally {
      setIsFetchingMore(false);
    }
  }, [query.toString(), isFetchingMore]);

  const questions = useMemo(() => {
    const initial = data?.questions ?? [];
    return [...initial, ...extraQuestions];
  }, [data?.questions, extraQuestions]);

  return useMemo(() => ({
    questions,
    isLoading,
    isError: error,
    hasMore,
    nextCursor,
    isFetchingMore,
    fetchMore,
    mutate,
  }), [questions, isLoading, error, hasMore, nextCursor, isFetchingMore, fetchMore, mutate]);
}
