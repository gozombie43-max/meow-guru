"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import useSWR, { unstable_serialize, useSWRConfig } from "swr";
import { API_BASE } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/api/http";
import { useAuth } from "@/context/AuthContext";
import { PUBLIC_QUESTION_QUERY } from "@/features/quiz/api/publicQuery";
import { useAbortableResource } from "@/lib/use-abortable-resource";

type Progress = Record<string, { userSolved: number; userMastered: number }>;
type Snapshot = { subject: string; revision: number; totals: Record<string, number>; updatedAt: string };
export type TopicQuestionSnapshot = Snapshot & { userProgress?: Progress };
type CachedProgress = { owner: string; subject: string; userProgress: Progress; version: number };

const cacheBySubject = new Map<string, Snapshot | undefined>();
const subscribe = () => () => {};
const serverSnapshot = () => undefined;
let progressVersion = 0;
const progressListeners = new Set<() => void>();

/** Marks cached personal topic progress stale and refreshes any mounted hub. */
export function invalidateTopicProgressCache() {
  progressVersion += 1;
  progressListeners.forEach((listener) => listener());
}

function publicSnapshot(value: unknown, subject: string): Snapshot | undefined {
  if (!value || typeof value !== "object") return;
  const s = value as Snapshot;
  if (s.subject !== subject || !Number.isInteger(s.revision) || s.revision < 0 ||
      !Number.isFinite(Date.parse(s.updatedAt)) || !s.totals || typeof s.totals !== "object" ||
      Array.isArray(s.totals) || !Object.values(s.totals).every(n => Number.isInteger(n) && n >= 0)) return;
  // Whitelist public fields, including when migrating the old combined cache.
  return { subject: s.subject, revision: s.revision, updatedAt: s.updatedAt, totals: s.totals };
}
function store(snapshot: Snapshot) {
  cacheBySubject.set(snapshot.subject, snapshot);
  try { localStorage.setItem(`${snapshot.subject}-topic-counts:v4`, JSON.stringify(snapshot)); }
  catch { /* Optional public cache. */ }
}
function getStoredSnapshot(subject: string) {
  if (cacheBySubject.has(subject)) return cacheBySubject.get(subject);
  let stored: Snapshot | undefined;
  try {
    stored = publicSnapshot(JSON.parse(localStorage.getItem(`${subject}-topic-counts:v4`) ||
      localStorage.getItem(`${subject}-topic-counts:v3`) || "null"), subject);
    localStorage.removeItem(`${subject}-topic-counts:v3`);
    if (stored) store(stored);
  } catch { /* Public network data remains available without storage. */ }
  cacheBySubject.set(subject, stored);
  return stored;
}
async function fetchSnapshot(url: string) {
  const response = await fetchWithRetry(url, {}, { auth: "none" });
  if (!response.ok) throw new Error("Unable to load topic totals");
  const subject = new URL(url, "http://localhost").searchParams.get("subject") || "mathematics";
  const snapshot = publicSnapshot(await response.json(), subject);
  if (!snapshot) throw new Error("Invalid topic totals");
  store(snapshot);
  return snapshot;
}
export function useTopicQuestionTotals(subject = "mathematics") {
  const { user, token, loading } = useAuth();
  const owner = user?.id;
  const ready = !loading && !!owner && !!token;
  const { fallback, cache } = useSWRConfig();
  const url = `${API_BASE}/api/questions/topic-counts?subject=${encodeURIComponent(subject)}`;
  const stored = useSyncExternalStore(subscribe, () => getStoredSnapshot(subject), serverSnapshot);
  const fallbackEntry = fallback?.[url];
  const seeded = useMemo(() => publicSnapshot(fallbackEntry, subject), [fallbackEntry, subject]);
  const cachedCatalog = cache.get(url)?.data as Snapshot | undefined;
  const hasCachedCatalog = Boolean(cachedCatalog);

  const initialCatalog =
    seeded && (!stored || seeded.revision >= stored.revision)
      ? seeded
      : (cachedCatalog ?? stored ?? seeded);

  const catalog = useSWR<Snapshot>(url, fetchSnapshot, {
    ...PUBLIC_QUESTION_QUERY,
    fallbackData: initialCatalog,
    revalidateOnMount: !seeded && !hasCachedCatalog,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });

  const mutateCatalog = catalog.mutate;
  useEffect(() => {
    if (seeded && !cache.get(url)?.data) {
      void mutateCatalog(seeded, { revalidate: false });
    }
  }, [seeded, url, cache, mutateCatalog]);

  const key = ready ? ["topic-progress", owner, subject] : null;
  const serialized = key ? unstable_serialize(key) : null;
  const cachedEntry = serialized
    ? (cache.get(serialized)?.data as CachedProgress | undefined)
    : undefined;
  const isFreshPersonal = Boolean(
    cachedEntry &&
      cachedEntry.owner === owner &&
      cachedEntry.subject === subject &&
      cachedEntry.version === progressVersion
  );
  const read = useAbortableResource(serialized);
  const personal = useSWR(
    key,
    async () => {
      const cached = serialized
        ? (cache.get(serialized)?.data as CachedProgress | undefined)
        : undefined;
      if (
        cached &&
        cached.owner === owner &&
        cached.subject === subject &&
        cached.version === progressVersion
      ) {
        return cached;
      }
      const fetchVersion = progressVersion;
      return read(async (signal) => {
        const response = await fetchWithRetry(
          `${API_BASE}/api/progress/topics/private?subject=${encodeURIComponent(subject)}`,
          { signal }
        );
        if (!response.ok) throw new Error("Unable to load topic progress");
        const data = (await response.json()) as { subject: string; userProgress: Progress };
        if (data.subject !== subject || !data.userProgress || typeof data.userProgress !== "object") {
          throw new Error("Invalid topic progress");
        }
        return { owner: owner!, subject, userProgress: data.userProgress, version: fetchVersion };
      });
    },
    {
      revalidateOnMount: !isFreshPersonal,
      revalidateIfStale: false,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60_000,
      shouldRetryOnError: false,
    }
  );

  const mutatePersonal = personal.mutate;
  useEffect(() => {
    const handleInvalidate = () => {
      void mutatePersonal();
    };
    progressListeners.add(handleInvalidate);
    return () => {
      progressListeners.delete(handleInvalidate);
    };
  }, [mutatePersonal]);

  const personalData = personal.data;
  const hasValidPersonal = Boolean(
    ready && personalData?.owner === owner && personalData.subject === subject
  );
  const combinedData = useMemo(() => {
    if (!catalog.data) return undefined;
    const userProgress = hasValidPersonal && personalData ? personalData.userProgress : {};
    return { ...catalog.data, userProgress };
  }, [catalog.data, hasValidPersonal, personalData]);

  const totalsPending = !catalog.data && !catalog.error;
  const progressPending = loading || (ready && !hasValidPersonal && !personal.error);

  return {
    ...catalog,
    data: combinedData,
    error: catalog.error ?? personal.error,
    totalsPending,
    progressPending,
  };
}
