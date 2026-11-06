import { useCallback, useMemo, useSyncExternalStore } from "react";
import useSWR, { useSWRConfig } from "swr";
import { fetchWithRetry } from "@/lib/api/http";
import { API_BASE } from "@/lib/api-base";
import { PUBLIC_QUESTION_QUERY } from '@/features/quiz/api/publicQuery';
import { readPersisted, subscribePersisted, writePersisted, type PersistedEntry } from "@/lib/persistentQueryCache";

/** Persisted counts younger than this are trusted without a network request
 *  (mirrors the API's `Cache-Control: max-age`). Older ones are shown
 *  instantly and refreshed in the background. */
const PERSISTED_FRESH_MS = 60_000;

interface QuestionCountsResponse {
  concept: number;
  formula: number;
  mixed: number;
  aiChallenge: number;
  easy: number;
  hard: number;
  studyMode: number;
}

export interface ModeQuestionCounts {
  [mode: string]: number;
  concept: number;
  formula: number;
  mixed: number;
  "ai-challenge": number;
  easy: number;
  hard: number;
  "study-mode": number;
}

const EMPTY_COUNTS: ModeQuestionCounts = {
  concept: 0,
  formula: 0,
  mixed: 0,
  "ai-challenge": 0,
  easy: 0,
  hard: 0,
  "study-mode": 0,
};

async function fetchCounts(url: string): Promise<QuestionCountsResponse> {
  const response = await fetchWithRetry(url, {}, { auth: 'none' });
  if (!response.ok) throw new Error("Failed to fetch question counts");
  return response.json();
}

function isCountsResponse(value: unknown): value is QuestionCountsResponse {
  return typeof value === "object" && value !== null && typeof (value as QuestionCountsResponse).concept === "number";
}

export function questionCountsUrl(params: { topic?: string; subject?: string }): string | null {
  if (!params.topic && !params.subject) return null;
  const query = new URLSearchParams();
  if (params.topic) query.set("topic", params.topic);
  if (params.subject) query.set("subject", params.subject);
  return `${API_BASE}/api/questions/counts?${query.toString()}`;
}

const inflightPrefetches = new Map<string, Promise<void>>();

/**
 * Intent-prefetch question counts into the persistent cache (e.g. on
 * `pointerenter` / `touchstart` of a topic or chapter row) so that the counts
 * are already warm by the time the route finishes transitioning.
 */
export function prefetchQuestionCounts(params: { topic?: string; subject?: string }): void {
  const url = questionCountsUrl(params);
  if (!url) return;
  const existing = readPersisted<QuestionCountsResponse>(url);
  if (existing && Date.now() - existing.savedAt < PERSISTED_FRESH_MS) return;
  if (inflightPrefetches.has(url)) return;

  const task = fetchCounts(url)
    .then((fresh) => {
      if (isCountsResponse(fresh)) writePersisted(url, fresh);
    })
    .catch(() => {
      // Silent fail on speculative prefetch; the page mount will retry normally.
    })
    .finally(() => {
      inflightPrefetches.delete(url);
    });
  inflightPrefetches.set(url, task);
}

const noopSubscribe = () => () => {};
const serverSnapshot = () => undefined;

/** Persisted (localStorage) entry for `key`. Returns undefined on the server
 *  and during hydration, so SSR markup always matches; the persisted value is
 *  applied immediately after hydration, and instantly on client navigations. */
function usePersistedEntry(key: string | null): PersistedEntry<QuestionCountsResponse> | undefined {
  const getSnapshot = useCallback(
    () => (key ? readPersisted<QuestionCountsResponse>(key) : undefined),
    [key],
  );
  return useSyncExternalStore(key ? subscribePersisted : noopSubscribe, getSnapshot, serverSnapshot);
}

/**
 * Question counts per practice mode, with three cache layers:
 *  1. SWR in-memory cache (per session, deduped for 60s, no refetch on remount)
 *  2. localStorage stale-while-revalidate (survives reloads / app restarts,
 *     rendered instantly, refreshed in the background when older than 60s,
 *     and used as an offline fallback when the request fails)
 *  3. Browser HTTP cache + server tiered cache (Cache-Control from the API)
 */
export function useQuestionCounts(params: {
  enabled?: boolean;
  topic?: string;
  subject?: string;
}) {
  const url = params.enabled === false ? null : questionCountsUrl(params);
  const { cache } = useSWRConfig();
  const persisted = usePersistedEntry(url);

  // Only hit the network on mount when neither the session cache nor a fresh
  // persisted copy can answer. (SWR reads this option only on initial mount.)
  const inMemory = url !== null && cache.get(url)?.data !== undefined;
  // eslint-disable-next-line react-hooks/purity -- freshness check is intentionally time-based
  const persistedIsFresh = persisted !== undefined && Date.now() - persisted.savedAt < PERSISTED_FRESH_MS;

  const { data, error, isLoading, mutate } = useSWR<QuestionCountsResponse>(url, fetchCounts, {
    ...PUBLIC_QUESTION_QUERY,
    fallbackData: persisted?.data,
    revalidateOnMount: !inMemory && !persistedIsFresh,
    revalidateOnFocus: false,
    revalidateIfStale: false,
    shouldRetryOnError: false,
    dedupingInterval: 60000,
    onSuccess: (fresh, key) => {
      if (isCountsResponse(fresh)) writePersisted(key, fresh);
    },
  });

  const counts = useMemo<ModeQuestionCounts>(() => data
    ? {
        concept: data.concept,
        formula: data.formula,
        mixed: data.mixed,
        "ai-challenge": data.aiChallenge,
        easy: data.easy,
        hard: data.hard,
        "study-mode": data.studyMode,
      }
    : EMPTY_COUNTS, [data]);

  // SWR reports isLoading=false during SSR/hydration (no request has started
  // yet), which made consumers briefly render "0"/"Soon" before the skeleton.
  // isPending stays true until real (or persisted) data or an error arrives.
  const isPending = url !== null && data === undefined && !error;
  // A failed refresh is not an error for the UI while we still have
  // last-known counts to show (offline / flaky network).
  const isError = data === undefined ? error : undefined;

  return useMemo(() => ({
    counts,
    isLoading,
    isPending,
    isError,
    mutate,
  }), [counts, isError, isLoading, isPending, mutate]);
}
