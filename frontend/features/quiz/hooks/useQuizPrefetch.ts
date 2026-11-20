"use client";
import { useEffect, useRef } from 'react';
import type { QuizQuestion } from '../model/types';
import type { QuizLruCache } from '../model/quizLruCache';
import { computePrefetchTriggerIndex, DEFAULT_PREFETCH_THRESHOLD } from '../model/constants';
import { prefetchQuestionImage } from '../model/utils';

const MARKDOWN_IMAGE_URL = /!\[[^\]]*\]\(([^)\s]+)\)/g;

export function extractQuestionImageUrls(question: QuizQuestion | undefined): string[] {
  if (!question || question.sessionPlaceholder) return [];
  const urls = new Set<string>();
  if (question.questionImage) {
    urls.add(question.questionImage);
  }
  const scan = (text?: string) => {
    if (!text) return;
    for (const match of text.matchAll(MARKDOWN_IMAGE_URL)) {
      if (match[1]) urls.add(match[1]);
    }
  };
  scan(question.question);
  for (const option of question.options ?? []) {
    scan(option);
  }
  return Array.from(urls);
}

export function useQuizPrefetch({
  started,
  showAnalytics,
  currentIndex,
  questions,
  hasMore,
  isFetchingMore,
  hasError = false,
  prefetchThreshold = DEFAULT_PREFETCH_THRESHOLD,
  fetchMore,
  ensureQuestion,
  cache,
}: {
  started: boolean;
  showAnalytics: boolean;
  currentIndex: number;
  questions: QuizQuestion[];
  hasMore: boolean;
  isFetchingMore: boolean;
  hasError?: boolean;
  prefetchThreshold?: number;
  fetchMore: () => Promise<void> | void;
  ensureQuestion?: (index: number) => Promise<void>;
  cache: QuizLruCache;
}): void {
  const prefetchedImages = useRef(new Set<string>());

  useEffect(() => {
    if (!questions.length || showAnalytics) return;
    cache.pinWindow(currentIndex);

    // Warm local question buffer entries in the LRU window without prefetching
    // unsubmitted answer keys or solutions from the server.
    const windowIndices = (!started
      ? [currentIndex]
      : [
          currentIndex,
          currentIndex + 1,
          currentIndex + 2,
          currentIndex - 1,
          currentIndex + 3,
        ]
    ).filter((idx) => idx >= 0 && idx < questions.length);

    for (const idx of windowIndices) {
      const q = questions[idx];
      if (!q || q.sessionPlaceholder) continue;
      cache.setQuestion(idx, q);
    }
  }, [started, currentIndex, questions, showAnalytics, cache]);

  useEffect(() => {
    if (!started || showAnalytics) return;

    // 1. Background batch prefetch before the loaded cursor buffer ends (tunable threshold).
    const triggerIndex = computePrefetchTriggerIndex(questions.length, prefetchThreshold);
    if (hasMore && !isFetchingMore && !hasError && questions.length > 0 && currentIndex >= triggerIndex) {
      void fetchMore();
    }

    // 2. Background window prefetch if either of the next 2 questions (or previous 1) is a placeholder.
    if (ensureQuestion) {
      for (const offset of [1, 2, -1]) {
        const targetIndex = currentIndex + offset;
        if (targetIndex >= 0 && targetIndex < questions.length && questions[targetIndex]?.sessionPlaceholder) {
          void ensureQuestion(targetIndex).catch(() => {});
        }
      }
    }

    // 3. Background image prefetch for the next 2 questions (deduplicated).
    for (const offset of [1, 2]) {
      const upcoming = questions[currentIndex + offset];
      for (const url of extractQuestionImageUrls(upcoming)) {
        if (!prefetchedImages.current.has(url)) {
          prefetchedImages.current.add(url);
          prefetchQuestionImage(url);
        }
      }
    }
  }, [started, showAnalytics, currentIndex, questions, hasMore, isFetchingMore, hasError, prefetchThreshold, fetchMore, ensureQuestion]);
}
