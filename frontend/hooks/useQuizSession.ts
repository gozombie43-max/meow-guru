import { getQuestionSessionRevision } from "@/features/quiz/api/questionWrites";
import { API_BASE } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/api/http";
import type { Question } from "@/lib/api/questions";
import { useCallback, useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";

interface SessionResponse {
  questions: Question[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
  startIndex?: number;
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
  anchor?: string;
  resumeIndex?: number;
  includeTotal?: boolean;
}) {
  const { subject, topic, mode, limit = 50, letter, exam, concept, enabled = true, includeTotal = false, anchor, resumeIndex } = params;

  const [revision] = useState(getQuestionSessionRevision);
  const query = new URLSearchParams();
  if (revision) query.set("revision", String(revision));
  if (subject) query.set("subject", subject);
  if (topic) query.set("topic", topic);
  if (mode) query.set("mode", mode);
  if (letter) query.set("letter", letter);
  if (exam) query.set("exam", exam);
  if (concept) query.set("concept", concept);
  if (anchor) query.set('anchor', anchor);
  if (resumeIndex !== undefined) query.set('resumeIndex', String(resumeIndex));
  query.set("limit", String(limit));
  query.set("includeTotal", String(includeTotal));

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
        const nextPage = new URL(url, 'http://localhost');
        nextPage.searchParams.delete('anchor');
        nextPage.searchParams.delete('resumeIndex');
        nextPage.searchParams.set('cursor', previousPage!.nextCursor!);
        nextPage.searchParams.set('includeTotal', 'false');
        return `${url.split('?')[0]}?${nextPage.searchParams}`;
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
  const [extraPages, setExtraPages] = useState<Record<string, SessionResponse>>({});
  const windowRequests = useRef(new Map<string, Promise<void>>());
  const questions = useMemo(() => {
    if (!data?.[0]) return [];
    const start = data[0].startIndex ?? 0;
    const rows = data.flatMap(page => page.questions);
    const prefix = Array.from({ length: start }, (_, index) => ({
      id: `unloaded:${index}`, question: '', options: [], sessionPlaceholder: true,
    } as unknown as Question));
    const result = [...prefix, ...rows];
    for (const [key, page] of Object.entries(extraPages)) {
      if (!key.startsWith(`${url}|`)) continue;
      for (let i = 0; i < page.questions.length; i++) result[(page.startIndex ?? 0) + i] = page.questions[i];
    }
    return result;
  }, [data, extraPages, url]);
  const ensureQuestion = useCallback(async (index: number) => {
    if (!url || !questions[index]?.sessionPlaceholder) return;
    const offset = Math.floor(index / limit) * limit;
    const key = `${url}|${offset}`;
    let pendingWindow = windowRequests.current.get(key);
    if (!pendingWindow) {
      const windowUrl = new URL(url, 'http://localhost');
      windowUrl.searchParams.delete('anchor');
      windowUrl.searchParams.delete('resumeIndex');
      windowUrl.searchParams.set('windowOffset', String(offset));
      windowUrl.searchParams.set('includeTotal', 'false');
      pendingWindow = fetcher(`${url.split('?')[0]}?${windowUrl.searchParams}`).then(page => {
        setExtraPages(previous => ({ ...previous, [key]: page }));
      }).finally(() => windowRequests.current.delete(key));
      windowRequests.current.set(key, pendingWindow);
    }
    await pendingWindow;
  }, [url, questions, limit]);

  const totalCount = data?.[0]?.totalCount ?? 0;
  const isInitialLoading = Boolean(isLoading || (!data?.[0] && isValidating));

  return {
    questions,
    ensureQuestion,
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
