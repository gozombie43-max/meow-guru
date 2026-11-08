"use client";
import { useEffect, useRef } from 'react';
import type { QuizQuestion } from '../model/types';
import type { QuizLruCache } from '../model/quizLruCache';
import type { QuizAnswerResponse } from '../model/resumeDelta';
import { prefetchQuestionImage } from '../model/utils';
import * as userApi from '@/lib/userApi';

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
  fetchMore,
  ensureQuestion,
  cache,
  onRevealPrefetched,
}: {
  started: boolean;
  showAnalytics: boolean;
  currentIndex: number;
  questions: QuizQuestion[];
  hasMore: boolean;
  isFetchingMore: boolean;
  fetchMore: () => Promise<void> | void;
  ensureQuestion?: (index: number) => Promise<void>;
  cache: QuizLruCache;
  onRevealPrefetched?: (index: number, questionId: string | number, revealed: QuizAnswerResponse) => void;
}): void {
  const prefetchedImages = useRef(new Set<string>());
  const inFlightReveals = useRef(new Set<string>());
  const onRevealPrefetchedRef = useRef(onRevealPrefetched);

  useEffect(() => {
    onRevealPrefetchedRef.current = onRevealPrefetched;
  }, [onRevealPrefetched]);

  useEffect(() => {
    if (!questions.length || showAnalytics) return;
    cache.pinWindow(currentIndex);

    // Warm the LRU cache for current, next 2, and adjacent questions synchronously.
    const windowIndices = [
      currentIndex,
      currentIndex + 1,
      currentIndex + 2,
      currentIndex - 1,
      currentIndex + 3,
    ].filter((idx) => idx >= 0 && idx < questions.length);

    const toPrefetch: Array<{ idx: number; q: QuizQuestion; clientKey: string }> = [];

    for (const idx of windowIndices) {
      const q = questions[idx];
      if (!q || q.sessionPlaceholder) continue;
      cache.setQuestion(idx, q);

      if (q.correctAnswer >= 0) continue;
      const existingReveal = cache.getPrefetchedReveal(idx, q.id);
      if (existingReveal && typeof existingReveal.correct === 'number' && existingReveal.correct >= 0) {
        continue;
      }

      const clientKey = String(q.id);
      if (inFlightReveals.current.has(clientKey)) continue;
      toPrefetch.push({ idx, q, clientKey });
    }

    if (toPrefetch.length > 0 && typeof userApi.prefetchQuestionReveals === 'function') {
      for (const entry of toPrefetch) {
        inFlightReveals.current.add(entry.clientKey);
      }
      const payload: userApi.PrefetchRevealItem[] = toPrefetch.map(({ q, clientKey }) => ({
        clientKey,
        id: q.rawId || q.id,
        questionUid: q.questionUid,
        sessionAnchor: q.sessionAnchor,
      }));

      void Promise.resolve(userApi.prefetchQuestionReveals(payload))
        .then((res) => {
          const reveals = (res as { data?: { reveals?: Record<string, QuizAnswerResponse> } })?.data?.reveals;
          if (!reveals || typeof reveals !== 'object') return;
          for (const { idx, q, clientKey } of toPrefetch) {
            const revealed = reveals[clientKey];
            if (revealed && typeof revealed.correct === 'number' && revealed.correct >= 0) {
              cache.setPrefetchedReveal(idx, q.id, revealed, q);
              if (revealed.solutionImage && !prefetchedImages.current.has(revealed.solutionImage)) {
                prefetchedImages.current.add(revealed.solutionImage);
                prefetchQuestionImage(revealed.solutionImage);
              }
              onRevealPrefetchedRef.current?.(idx, q.id, revealed);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          for (const entry of toPrefetch) {
            inFlightReveals.current.delete(entry.clientKey);
          }
        });
    }
  }, [currentIndex, questions, showAnalytics, cache]);

  useEffect(() => {
    if (!started || showAnalytics) return;

    // 1. Background page prefetch when approaching the end of the loaded cursor window.
    if (hasMore && !isFetchingMore && currentIndex >= questions.length - 5) {
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
  }, [started, showAnalytics, currentIndex, questions, hasMore, isFetchingMore, fetchMore, ensureQuestion]);
}
