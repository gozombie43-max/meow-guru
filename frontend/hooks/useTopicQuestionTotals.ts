"use client";

import { useSyncExternalStore } from "react";
import useSWR from "swr";
import { API_BASE } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/api/http";

type Snapshot = { 
  subject: string; 
  revision: number; 
  totals: Record<string, number>; 
  updatedAt: string;
  userProgress?: Record<string, { userSolved: number; userMastered: number }>;
};

const cacheBySubject = new Map<string, Snapshot | undefined>();
const subscribe = () => () => {};
const serverSnapshot = () => undefined;

function isSnapshot(value: unknown, expectedSubject: string): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Snapshot;
  return snapshot.subject === expectedSubject && Number.isFinite(snapshot.revision) &&
    typeof snapshot.updatedAt === "string" && !!snapshot.totals &&
    typeof snapshot.totals === "object" && !Array.isArray(snapshot.totals) &&
    Object.values(snapshot.totals).every(count => Number.isInteger(count) && count >= 0);
}

function getStoredSnapshot(subject: string): Snapshot | undefined {
  if (cacheBySubject.has(subject)) {
    return cacheBySubject.get(subject);
  }
  let stored: Snapshot | undefined;
  try {
    const value: unknown = JSON.parse(localStorage.getItem(`${subject}-topic-counts:v3`) || "null");
    if (isSnapshot(value, subject)) stored = value;
  } catch { /* Storage can be unavailable; the metadata request still works. */ }
  cacheBySubject.set(subject, stored);
  return stored;
}

async function fetchSnapshot(url: string): Promise<Snapshot> {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error("Unable to load topic totals");
  const snapshot: unknown = await response.json();
  const urlObj = new URL(url, "http://localhost");
  const subject = urlObj.searchParams.get("subject") || "mathematics";
  if (!isSnapshot(snapshot, subject)) throw new Error("Invalid topic totals");
  cacheBySubject.set(subject, snapshot);
  try { localStorage.setItem(`${subject}-topic-counts:v3`, JSON.stringify(snapshot)); } catch { /* Optional cache. */ }
  return snapshot;
}

export function useTopicQuestionTotals(subject: string = "mathematics") {
  const fallbackData = useSyncExternalStore(
    subscribe,
    () => getStoredSnapshot(subject),
    serverSnapshot
  );
  return useSWR<Snapshot>(
    `${API_BASE}/api/progress/topics?subject=${encodeURIComponent(subject)}`,
    fetchSnapshot,
    {
      fallbackData,
      revalidateOnMount: true,
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      errorRetryCount: 2,
    }
  );
}
