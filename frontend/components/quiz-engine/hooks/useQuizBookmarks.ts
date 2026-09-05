"use client";
import { toggleBookmark } from "@/lib/userApi";
import { useCallback, useRef, useState } from "react";
import type { QuizQuestion } from "../types";

export function useQuizBookmarks({
  currentQ,
  token,
  initialBookmarks,
  meta,
}: {
  currentQ: QuizQuestion | undefined;
  token: string | null;
  initialBookmarks?: string[];
  meta: Parameters<typeof toggleBookmark>[3];
}) {
  const [changes, setChanges] = useState<Record<string, boolean>>({});
  const pending = useRef(new Set<string>());
  const bookmarked = new Set(initialBookmarks ?? []);
  for (const [id, selected] of Object.entries(changes)) {
    if (selected) bookmarked.add(id);
    else bookmarked.delete(id);
  }
  const handleBookmark = useCallback(async () => {
    if (!currentQ || !token) return;
    const id = String(currentQ.id);
    if (pending.current.has(id)) return;
    pending.current.add(id);
    const previous = changes[id] ?? (initialBookmarks ?? []).includes(id);
    setChanges((state) => ({ ...state, [id]: !previous }));
    try {
      await toggleBookmark(token, id, previous ? "remove" : "add", meta);
    } catch {
      setChanges((state) => ({ ...state, [id]: previous }));
    } finally {
      pending.current.delete(id);
    }
  }, [currentQ, token, changes, initialBookmarks, meta]);
  return { bookmarked, handleBookmark };
}
