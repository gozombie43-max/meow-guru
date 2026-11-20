import { getQuestionSessionRevision } from "@/features/quiz/api/questionWrites";
import { canonicalQuestionKey, DEFAULT_QUIZ_BATCH_SIZE } from "@/features/quiz/model/constants";
import { API_BASE } from "@/lib/api-base";
import { consumeEarlyRouteData } from "@/lib/early-session";
import { PUBLIC_QUESTION_QUERY } from '@/features/quiz/api/publicQuery';
import { fetchWithRetry } from "@/lib/api/http";
import type { Question } from "@/features/quiz/api/questions";
import { abortError } from "@/shared/api/policy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWRInfinite from "swr/infinite";

interface SessionResponse {
  questions: Question[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
  startIndex?: number;
}

interface ScopedExtraPages {
  scope: string | null;
  pages: Record<string, SessionResponse>;
}

const fetchSessionUrl = async (url: string, signal?: AbortSignal): Promise<SessionResponse> => {
  if (signal?.aborted) throw abortError();
  const early = consumeEarlyRouteData<SessionResponse>(API_BASE, `public:GET:${url}`, null, signal);
  if (early) {
    const preloaded = await early;
    if (signal?.aborted) throw abortError();
    if (preloaded) return preloaded;
  }
  const parsed = new URL(url, 'http://localhost');
  // Use the same SWR key and pagination parameters for both read transports.
  const useBody = url.length > 2000;
  const init: RequestInit = useBody
    ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(parsed.searchParams)),
        ...(signal ? { signal } : {}),
      }
    : (signal ? { signal } : {});
  const res = await fetchWithRetry(useBody ? url.split('?')[0] : url, init, { auth: 'none' });
  if (signal?.aborted) throw abortError();
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
  const {
    subject,
    topic,
    mode,
    limit = DEFAULT_QUIZ_BATCH_SIZE,
    letter,
    exam,
    concept,
    enabled = true,
    includeTotal = false,
    anchor,
    resumeIndex,
  } = params;

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

  // Per-scope AbortControllers and in-flight deduplication for both cursor pages and window jumps.
  const activeUrlRef = useRef<string | null>(url);
  const mountedRef = useRef(true);
  const scopeControllers = useRef(new Map<string, Map<string, AbortController>>());
  const inflightPages = useRef(new Map<string, Promise<SessionResponse>>());

  const abortScope = useCallback((scopeKey: string) => {
    const controllers = scopeControllers.current.get(scopeKey);
    if (!controllers) return;
    for (const [reqKey, controller] of controllers.entries()) {
      controller.abort();
      inflightPages.current.delete(reqKey);
    }
    scopeControllers.current.delete(scopeKey);
  }, []);

  const abortAll = useCallback(() => {
    for (const scopeKey of Array.from(scopeControllers.current.keys())) {
      abortScope(scopeKey);
    }
    inflightPages.current.clear();
  }, [abortScope]);

  useEffect(() => {
    mountedRef.current = true;
    const previousUrl = activeUrlRef.current;
    activeUrlRef.current = url;
    if (previousUrl && previousUrl !== url) {
      abortScope(previousUrl);
    }
    return () => {
      const leavingUrl = url;
      mountedRef.current = false;
      queueMicrotask(() => {
        if (!mountedRef.current) {
          abortAll();
        } else if (leavingUrl && activeUrlRef.current !== leavingUrl) {
          abortScope(leavingUrl);
        }
      });
    };
  }, [url, abortScope, abortAll]);

  const fetchScopedPage = useCallback((pageUrl: string, scopeKey = url ?? '__none__'): Promise<SessionResponse> => {
    const reqKey = `${scopeKey}::${pageUrl}`;
    const existing = inflightPages.current.get(reqKey);
    if (existing) return existing;

    const controller = new AbortController();
    let bucket = scopeControllers.current.get(scopeKey);
    if (!bucket) {
      bucket = new Map();
      scopeControllers.current.set(scopeKey, bucket);
    }
    bucket.set(reqKey, controller);

    const request = fetchSessionUrl(pageUrl, controller.signal).finally(() => {
      if (inflightPages.current.get(reqKey) === request) {
        inflightPages.current.delete(reqKey);
      }
      const currentBucket = scopeControllers.current.get(scopeKey);
      if (currentBucket?.get(reqKey) === controller) {
        currentBucket.delete(reqKey);
        if (currentBucket.size === 0) scopeControllers.current.delete(scopeKey);
      }
    });

    inflightPages.current.set(reqKey, request);
    return request;
  }, [url]);

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
      (pageUrl: string) => fetchScopedPage(pageUrl, url ?? '__none__'),
      {
        ...PUBLIC_QUESTION_QUERY,
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

  const fetchMore = useCallback(async (options?: { retry?: boolean }) => {
    const shouldRetry = Boolean(options?.retry);
    if (!url || isValidating || pending.current) return;
    if (error && !shouldRetry) return;
    if (!hasMore && !(error && shouldRetry)) return;
    // SWR owns each cursor page, including cache restores and request isolation.
    pending.current = true;
    try {
      if (error && shouldRetry) {
        if (!data?.length) {
          await mutate();
        } else {
          // Retry only missing/failed tail pages without refetching already-loaded pages.
          await mutate(data, { revalidate: (pageData) => !pageData });
        }
      } else {
        await setSize((current) => current + 1);
      }
    } finally {
      pending.current = false;
    }
  }, [url, hasMore, isValidating, error, data, mutate, setSize]);

  const retryFetchMore = useCallback(async () => {
    await fetchMore({ retry: true });
  }, [fetchMore]);

  const [extraPagesState, setExtraPagesState] = useState<ScopedExtraPages>({ scope: null, pages: {} });
  const windowRequests = useRef(new Map<string, Promise<void>>());

  const questions = useMemo(() => {
    if (!data?.[0]) return [];
    const start = data[0].startIndex ?? 0;
    const rows = data.flatMap(page => page.questions);
    const prefix = Array.from({ length: start }, (_, index) => ({
      id: `unloaded:${index}`, question: '', options: [], sessionPlaceholder: true,
    } as unknown as Question));
    const merged: Question[] = [...prefix, ...rows];

    if (url && extraPagesState.scope === url) {
      for (const page of Object.values(extraPagesState.pages)) {
        for (let i = 0; i < page.questions.length; i++) {
          merged[(page.startIndex ?? 0) + i] = page.questions[i];
        }
      }
    }

    // Deduplicate non-placeholder questions by canonical identity while preserving first-seen order.
    const seen = new Set<string>();
    const deduped: Question[] = [];
    for (const item of merged) {
      if (!item) continue;
      if (item.sessionPlaceholder) {
        deduped.push(item);
        continue;
      }
      const key = canonicalQuestionKey(item);
      if (key) {
        if (seen.has(key)) continue;
        seen.add(key);
      }
      deduped.push(item);
    }
    return deduped;
  }, [data, extraPagesState, url]);

  // Keep a ref to `questions` so `ensureQuestion` maintains a stable identity across page appends.
  const questionsRef = useRef(questions);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  const ensureQuestion = useCallback(async (index: number) => {
    const scopeUrl = url;
    if (!scopeUrl || !questionsRef.current[index]?.sessionPlaceholder) return;
    const offset = Math.floor(index / limit) * limit;
    const key = `${scopeUrl}|${offset}`;
    let pendingWindow = windowRequests.current.get(key);
    if (!pendingWindow) {
      const windowUrl = new URL(scopeUrl, 'http://localhost');
      windowUrl.searchParams.delete('anchor');
      windowUrl.searchParams.delete('resumeIndex');
      windowUrl.searchParams.set('windowOffset', String(offset));
      windowUrl.searchParams.set('includeTotal', 'false');
      const targetUrl = `${scopeUrl.split('?')[0]}?${windowUrl.searchParams}`;
      pendingWindow = fetchScopedPage(targetUrl, scopeUrl).then(page => {
        if (!mountedRef.current || activeUrlRef.current !== scopeUrl) return;
        setExtraPagesState(previous => (
          previous.scope === scopeUrl
            ? { scope: scopeUrl, pages: { ...previous.pages, [key]: page } }
            : { scope: scopeUrl, pages: { [key]: page } }
        ));
      }).finally(() => {
        if (windowRequests.current.get(key) === pendingWindow) {
          windowRequests.current.delete(key);
        }
      });
      windowRequests.current.set(key, pendingWindow);
    }
    await pendingWindow;
  }, [url, limit, fetchScopedPage]);

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
    retryFetchMore,
    totalCount,
    mutate,
  };
}
