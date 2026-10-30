"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "recent-study:v1";

interface RecentStudyState {
  topics: Record<string, string>;
  chapters: Record<string, string>;
}

const EMPTY_STATE: RecentStudyState = {
  topics: {},
  chapters: {},
};

let cachedRaw: string | null = null;
let cachedState: RecentStudyState = EMPTY_STATE;
const listeners = new Set<() => void>();

function parseState(raw: string | null): RecentStudyState {
  if (!raw) return EMPTY_STATE;
  try {
    const parsed = JSON.parse(raw) as Partial<RecentStudyState> | null;
    if (!parsed || typeof parsed !== "object") return EMPTY_STATE;
    const topics =
      parsed.topics && typeof parsed.topics === "object" && !Array.isArray(parsed.topics)
        ? (parsed.topics as Record<string, string>)
        : {};
    const chapters =
      parsed.chapters && typeof parsed.chapters === "object" && !Array.isArray(parsed.chapters)
        ? (parsed.chapters as Record<string, string>)
        : {};
    return { topics, chapters };
  } catch {
    return EMPTY_STATE;
  }
}

function getSnapshot(): RecentStudyState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw !== cachedRaw) {
      cachedRaw = raw;
      cachedState = parseState(raw);
    }
    return cachedState;
  } catch {
    return cachedState;
  }
}

function getServerSnapshot(): RecentStudyState {
  return EMPTY_STATE;
}

function emitChange() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (typeof window === "undefined") {
    return () => {
      listeners.delete(listener);
    };
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === STORAGE_KEY) {
      cachedRaw = null;
      emitChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function writeState(next: RecentStudyState) {
  const serialized = JSON.stringify(next);
  cachedRaw = serialized;
  cachedState = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      /* Storage may be unavailable in private browsing; in-memory state still updates. */
    }
  }
  emitChange();
}

export function recordRecentTopic(subject: string, topicSlug: string) {
  if (!subject || !topicSlug) return;
  const current = getSnapshot();
  if (current.topics[subject] === topicSlug) return;
  writeState({
    ...current,
    topics: {
      ...current.topics,
      [subject]: topicSlug,
    },
  });
}

export function recordRecentChapter(subject: string, groupSlug: string, chapterSlug: string) {
  if (!subject || !groupSlug || !chapterSlug) return;
  const current = getSnapshot();
  const chapterKey = `${subject}:${groupSlug}`;
  if (current.chapters[chapterKey] === chapterSlug && current.topics[subject] === groupSlug) {
    return;
  }
  writeState({
    topics: {
      ...current.topics,
      [subject]: groupSlug,
    },
    chapters: {
      ...current.chapters,
      [chapterKey]: chapterSlug,
    },
  });
}

export function recordRecentFromRoute(subject: string, routeBase: string) {
  if (!subject || !routeBase) return;
  const parts = routeBase.split("/").filter(Boolean);
  if (parts.length === 0) return;

  if (subject === "general-awareness" && parts.length >= 3) {
    recordRecentChapter("general-awareness", parts[1], parts[2]);
    return;
  }

  if (subject === "iit-jam-physics" && parts[0] === "subjects" && parts.length >= 4) {
    recordRecentChapter("iit-jam-physics", parts[2], parts[3]);
    return;
  }

  const leafSlug = parts[parts.length - 1];
  if (leafSlug) {
    recordRecentTopic(subject, leafSlug);
  }
}

export function useRecentTopic(subject: string): string | null {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return state.topics[subject] ?? null;
}

export function useRecentChapter(subject: string, groupSlug: string): string | null {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return state.chapters[`${subject}:${groupSlug}`] ?? null;
}
