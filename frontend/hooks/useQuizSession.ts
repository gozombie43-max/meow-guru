import { API_BASE } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/api/http";
import type { Question } from "@/lib/api/questions";
import { useCallback, useMemo, useRef } from "react";
import useSWRInfinite from "swr/infinite";

interface SessionResponse {
  questions: Question[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

const fetcher = async (url: string): Promise<SessionResponse> => {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error("Failed to fetch quiz session");
  return res.json();
};

export function useQuizSession(params: {
  subject: string;
  topic: string;
  mode?: string;
  limit?: number;
  letter?: string;
  exam?: string;
  concept?: string;
  enabled?: boolean;
}) {
  const { subject, topic, mode, limit = 50, letter, exam, concept, enabled = true } = params;

  const query = new URLSearchParams();
  if (subject) query.set("subject", subject);
  if (topic) query.set("topic", topic);
  if (mode) query.set("mode", mode);
  if (letter) query.set("letter", letter);
  if (exam) query.set("exam", exam);
  if (concept) query.set("concept", concept);
  query.set("limit", String(limit));

  const url = enabled
    ? `${API_BASE}/api/questions/session?${query.toString()}`
    : null;

  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<SessionResponse>(
      (pageIndex, previousPage: SessionResponse | null) => {
        if (
          !url ||
          (previousPage && (!previousPage.hasMore || !previousPage.nextCursor))
        )
          return null;
        if (pageIndex === 0) return url;
        return `${url}&cursor=${encodeURIComponent(previousPage!.nextCursor!)}`;
      },
      fetcher,
      {
        revalidateOnFocus: false,
        revalidateIfStale: false,
        revalidateFirstPage: false,
        shouldRetryOnError: false,
        persistSize: false,
        dedupingInterval: 60000,
      },
    );
  const lastPage = data?.[data.length - 1];
  const hasMore = Boolean(lastPage?.hasMore && lastPage.nextCursor);
  const nextCursor = lastPage?.nextCursor ?? null;
  const isFetchingMore = isValidating && size > 1;
  const pending = useRef(false);
  const fetchMore = useCallback(async () => {
    if (!hasMore || isValidating || error || pending.current) return;
    // SWR owns each cursor page, including cache restores and request isolation.
    pending.current = true;
    try {
      await setSize((current) => current + 1);
    } finally {
      pending.current = false;
    }
  }, [hasMore, isValidating, error, setSize]);
  const questions = useMemo(
    () => data?.flatMap((page) => page.questions) ?? [],
    [data],
  );

  const totalCount = data?.[0]?.totalCount ?? 0;
  const isInitialLoading = Boolean(isLoading || (!data?.[0] && isValidating));

  return {
    questions,
    isLoading: isInitialLoading,
    isError: error,
    hasMore,
    nextCursor,
    isFetchingMore,
    fetchMore,
    totalCount,
    mutate,
  };
}
