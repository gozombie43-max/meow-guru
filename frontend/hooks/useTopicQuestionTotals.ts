"use client";

import { useSyncExternalStore } from "react";
import useSWR from "swr";
import { API_BASE } from "@/lib/api-base";
import { fetchWithRetry } from "@/lib/api/http";

type Snapshot = { subject: string; revision: number; totals: Record<string, number>; updatedAt: string };
const STORAGE_KEY = "math-topic-counts:v1";
let stored: Snapshot | undefined;
let restored = false;
const subscribe = () => () => {};
const serverSnapshot = () => undefined;

function isSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Snapshot;
  return snapshot.subject === "mathematics" && Number.isFinite(snapshot.revision) &&
    typeof snapshot.updatedAt === "string" && !!snapshot.totals &&
    typeof snapshot.totals === "object" && !Array.isArray(snapshot.totals) &&
    Object.values(snapshot.totals).every(count => Number.isInteger(count) && count >= 0);
}

function readStoredSnapshot() {
  if (!restored) {
    restored = true;
    try {
      const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (isSnapshot(value)) stored = value;
    } catch { /* Storage can be unavailable; the metadata request still works. */ }
  }
  return stored;
}

async function fetchSnapshot(url: string): Promise<Snapshot> {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error("Unable to load topic totals");
  const snapshot: unknown = await response.json();
  if (!isSnapshot(snapshot)) throw new Error("Invalid topic totals");
  stored = snapshot;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)); } catch { /* Optional cache. */ }
  return snapshot;
}

export function useTopicQuestionTotals() {
  const fallbackData = useSyncExternalStore(subscribe, readStoredSnapshot, serverSnapshot);
  return useSWR<Snapshot>(`${API_BASE}/api/questions/topic-counts?subject=mathematics`, fetchSnapshot, {
    fallbackData,
    revalidateOnMount: true,
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    errorRetryCount: 2,
  });
}
