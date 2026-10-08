"use client";

import { useSyncExternalStore } from "react";
import useSWR, { unstable_serialize, useSWRConfig } from "swr";
import { API_BASE } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/api/http";
import { useAuth } from "@/context/AuthContext";
import { PUBLIC_QUESTION_QUERY } from "@/features/quiz/api/publicQuery";
import { useAbortableResource } from "@/lib/use-abortable-resource";

type Progress = Record<string, { userSolved: number; userMastered: number }>;
type Snapshot = { subject: string; revision: number; totals: Record<string, number>; updatedAt: string };
const cacheBySubject = new Map<string, Snapshot | undefined>();
const subscribe = () => () => {};
const serverSnapshot = () => undefined;

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
  const seeded = publicSnapshot(fallback?.[url], subject);
  const catalog = useSWR<Snapshot>(url, fetchSnapshot, {
    ...PUBLIC_QUESTION_QUERY,
    fallbackData: seeded ?? stored,
    revalidateOnMount: !seeded,
    dedupingInterval: 60_000,
    shouldRetryOnError: false,
  });
  const key = ready ? ['topic-progress', owner, subject] : null;
  const serialized = key ? unstable_serialize(key) : null;
  const read = useAbortableResource(serialized);
  const personal = useSWR(key, async () => {
    const cached = serialized ? cache.get(serialized)?.data as { owner: string; subject: string; userProgress: Progress; fetchedAt: number } | undefined : undefined;
    if (cached && Date.now() - cached.fetchedAt < 5000) return cached;
    return read(async signal => {
      const response = await fetchWithRetry(`${API_BASE}/api/progress/topics/private?subject=${encodeURIComponent(subject)}`, { signal });
      if (!response.ok) throw new Error("Unable to load topic progress");
      const data = await response.json() as { subject: string; userProgress: Progress };
      if (data.subject !== subject || !data.userProgress || typeof data.userProgress !== 'object') throw new Error("Invalid topic progress");
      return { owner: owner!, subject, userProgress: data.userProgress, fetchedAt: Date.now() };
    });
  }, { revalidateOnMount: true, dedupingInterval: 0, shouldRetryOnError: false });
  const userProgress = ready && personal.data?.owner === owner && personal.data.subject === subject ? personal.data.userProgress : {};
  return { ...catalog, data: catalog.data ? { ...catalog.data, userProgress } : undefined,
    error: catalog.error ?? personal.error };
}
