"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  canonicalQuestionKey,
  computePrefetchTriggerIndex,
  DEFAULT_PREFETCH_THRESHOLD,
  DEFAULT_QUIZ_BATCH_SIZE,
  MAX_QUIZ_BATCH_SIZE,
  type QuestionIdentityLike,
} from '@/features/quiz/model/constants';

export interface QuestionBatchResult<T> {
  questions: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
}

export interface UseQuestionBufferOptions<T extends QuestionIdentityLike, TAnswer = number> {
  /** Changing `queryKey` cancels obsolete in-flight requests and resets the local buffer. */
  queryKey: string | null;
  fetchBatch: (params: {
    cursor: string | null;
    batchSize: number;
    signal: AbortSignal;
  }) => Promise<QuestionBatchResult<T>>;
  getQuestionKey?: (question: T) => string | null;
  /** Initial and incremental batch size (typically 20–30, default 25). */
  batchSize?: number;
  /** Questions remaining before buffer end at which background prefetch triggers (default 6). */
  prefetchThreshold?: number;
  enabled?: boolean;
  /** Optional already-loaded initial batch (e.g. returned from `POST /api/v1/quiz/sessions`). */
  initialBatch?: QuestionBatchResult<T> | null;
  /** Optional initial local answer map keyed by canonical question key. */
  initialAnswers?: Record<string, TAnswer>;
}

interface BufferSnapshot<T, TAnswer> {
  scope: string | null;
  questions: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
  activeIndex: number;
  answers: Record<string, TAnswer>;
  isInitialLoading: boolean;
  isFetchingMore: boolean;
  error: Error | null;
}

const INITIAL_CURSOR_KEY = '__initial__';

function cursorDedupeKey(scope: string, cursor: string | null): string {
  return `${scope}::${cursor ?? INITIAL_CURSOR_KEY}`;
}

function isAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; code?: unknown; kind?: unknown };
  return (
    candidate.name === 'AbortError'
    || candidate.name === 'CanceledError'
    || candidate.code === 'ERR_CANCELED'
    || candidate.kind === 'aborted'
  );
}

function makeEmptySnapshot<T extends QuestionIdentityLike, TAnswer>(
  scope: string | null,
  initialBatch?: QuestionBatchResult<T> | null,
  getKey: (q: T) => string | null = canonicalQuestionKey,
  initialAnswers?: Record<string, TAnswer>,
): BufferSnapshot<T, TAnswer> {
  const deduped: T[] = [];
  const seen = new Set<string>();
  for (const item of initialBatch?.questions ?? []) {
    const key = getKey(item);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    deduped.push(item);
  }
  return {
    scope,
    questions: deduped,
    nextCursor: initialBatch?.nextCursor ?? null,
    hasMore: initialBatch ? Boolean(initialBatch.hasMore && initialBatch.nextCursor) : false,
    totalCount: initialBatch?.totalCount,
    activeIndex: 0,
    answers: initialAnswers ? { ...initialAnswers } : {},
    isInitialLoading: false,
    isFetchingMore: false,
    error: null,
  };
}

/**
 * Reusable batched question delivery hook providing:
 * - Bounded initial batching (default 25) and tunable background prefetching (default 6 remaining)
 * - Per-cursor in-flight request deduplication and loaded-cursor protection (never refetches same batch)
 * - Immediate `AbortController` cancellation on filter/mode (`queryKey`) change or unmount
 * - Canonical client-side deduplication (zero duplicate questions rendered)
 * - Network-interruption recovery retaining all loaded questions and local answer selections
 */
export function useQuestionBuffer<T extends QuestionIdentityLike, TAnswer = number>({
  queryKey,
  fetchBatch,
  getQuestionKey = canonicalQuestionKey,
  batchSize = DEFAULT_QUIZ_BATCH_SIZE,
  prefetchThreshold = DEFAULT_PREFETCH_THRESHOLD,
  enabled = true,
  initialBatch = null,
  initialAnswers,
}: UseQuestionBufferOptions<T, TAnswer>) {
  const safeBatchSize = Math.max(1, Math.min(MAX_QUIZ_BATCH_SIZE, Math.floor(batchSize)));
  const activeScope = enabled ? queryKey : null;

  const [state, setState] = useState<BufferSnapshot<T, TAnswer>>(() =>
    makeEmptySnapshot(activeScope, initialBatch, getQuestionKey, initialAnswers),
  );

  // Ref-stabilize callbacks and seed props so inline literals never abort in-flight fetches.
  const fetchBatchRef = useRef(fetchBatch);
  const getKeyRef = useRef(getQuestionKey);
  const initialBatchRef = useRef(initialBatch);
  const initialAnswersRef = useRef(initialAnswers);
  useEffect(() => {
    fetchBatchRef.current = fetchBatch;
    getKeyRef.current = getQuestionKey;
    initialBatchRef.current = initialBatch;
    initialAnswersRef.current = initialAnswers;
  }, [fetchBatch, getQuestionKey, initialBatch, initialAnswers]);

  const scopeRef = useRef<string | null>(activeScope);
  const initializedScopeRef = useRef<string | null>(null);
  const consumedSeedBatchRef = useRef<QuestionBatchResult<T> | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const seenKeysRef = useRef(new Set<string>());
  const loadedCursorsRef = useRef(new Set<string>());
  const inflightRequestsRef = useRef(new Map<string, Promise<void>>());
  const controllersRef = useRef(new Map<string, AbortController>());
  const failedCursorRef = useRef<string | null | undefined>(undefined);

  const abortActiveRequests = useCallback(() => {
    for (const controller of controllersRef.current.values()) {
      controller.abort();
    }
    controllersRef.current.clear();
    inflightRequestsRef.current.clear();
  }, []);

  const loadBatch = useCallback(async (cursor: string | null, options: { isInitial: boolean; retry?: boolean }) => {
    const scope = scopeRef.current;
    if (!scope) return;

    const dedupeKey = cursorDedupeKey(scope, cursor);

    // Never refetch an already-loaded batch unless explicitly reset.
    if (loadedCursorsRef.current.has(dedupeKey)) return;

    // Deduplicate concurrent calls for the same scope + cursor.
    const existing = inflightRequestsRef.current.get(dedupeKey);
    if (existing) return existing;

    const controller = new AbortController();
    controllersRef.current.set(dedupeKey, controller);

    setState(prev => {
      if (prev.scope !== scope) return prev;
      return {
        ...prev,
        isInitialLoading: options.isInitial ? true : prev.isInitialLoading,
        isFetchingMore: options.isInitial ? prev.isFetchingMore : true,
        error: options.retry ? null : prev.error,
      };
    });

    const task = (async () => {
      try {
        const batch = await fetchBatchRef.current({
          cursor,
          batchSize: safeBatchSize,
          signal: controller.signal,
        });
        if (controller.signal.aborted || scopeRef.current !== scope) return;

        loadedCursorsRef.current.add(dedupeKey);
        failedCursorRef.current = undefined;

        setState(prev => {
          if (prev.scope !== scope) return prev;
          const appended: T[] = [];
          for (const item of batch.questions) {
            const key = getKeyRef.current(item);
            if (key) {
              if (seenKeysRef.current.has(key)) continue;
              seenKeysRef.current.add(key);
            }
            appended.push(item);
          }
          return {
            ...prev,
            questions: options.isInitial && prev.questions.length === 0 ? appended : [...prev.questions, ...appended],
            nextCursor: batch.nextCursor ?? null,
            hasMore: Boolean(batch.hasMore && batch.nextCursor),
            totalCount: batch.totalCount ?? prev.totalCount,
            isInitialLoading: false,
            isFetchingMore: false,
            error: null,
          };
        });
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err) || scopeRef.current !== scope) return;
        failedCursorRef.current = cursor;
        const normalized = err instanceof Error ? err : new Error('Failed to load questions');
        setState(prev => {
          if (prev.scope !== scope) return prev;
          // Retain all already-loaded questions and answers on failure.
          return {
            ...prev,
            isInitialLoading: false,
            isFetchingMore: false,
            error: normalized,
          };
        });
      } finally {
        if (controllersRef.current.get(dedupeKey) === controller) {
          controllersRef.current.delete(dedupeKey);
          inflightRequestsRef.current.delete(dedupeKey);
        }
      }
    })();

    inflightRequestsRef.current.set(dedupeKey, task);
    return task;
  }, [safeBatchSize]);

  // Reset & abort whenever `activeScope` (filter/mode) changes or component unmounts.
  useEffect(() => {
    const prevScope = initializedScopeRef.current;
    scopeRef.current = activeScope;

    if (prevScope !== activeScope) {
      abortActiveRequests();
      seenKeysRef.current.clear();
      loadedCursorsRef.current.clear();
      failedCursorRef.current = undefined;
      initializedScopeRef.current = activeScope;

      const candidateSeed = initialBatchRef.current;
      const seedForScope =
        activeScope && candidateSeed && candidateSeed !== consumedSeedBatchRef.current
          ? candidateSeed
          : null;
      if (seedForScope) {
        consumedSeedBatchRef.current = seedForScope;
      }

      const fresh = makeEmptySnapshot<T, TAnswer>(
        activeScope,
        seedForScope,
        getKeyRef.current,
        initialAnswersRef.current,
      );
      for (const item of fresh.questions) {
        const key = getKeyRef.current(item);
        if (key) seenKeysRef.current.add(key);
      }
      if (activeScope && seedForScope) {
        loadedCursorsRef.current.add(cursorDedupeKey(activeScope, null));
      }
      if (prevScope !== null || stateRef.current.scope !== activeScope || (seedForScope && stateRef.current.questions.length === 0)) {
        setState(fresh);
      }
    }

    if (!activeScope) {
      return () => abortActiveRequests();
    }

    const initialKey = cursorDedupeKey(activeScope, null);
    if (!loadedCursorsRef.current.has(initialKey)) {
      void loadBatch(null, { isInitial: true });
    }

    return () => {
      abortActiveRequests();
    };
  }, [activeScope, abortActiveRequests, loadBatch]);

  const fetchNextBatch = useCallback(async () => {
    const current = stateRef.current;
    if (!scopeRef.current || current.scope !== scopeRef.current) return;
    if (!current.hasMore || !current.nextCursor || current.isFetchingMore || current.error) return;
    await loadBatch(current.nextCursor, { isInitial: false });
  }, [loadBatch]);

  const retry = useCallback(async () => {
    const current = stateRef.current;
    if (!scopeRef.current || current.scope !== scopeRef.current) return;
    const cursorToRetry = failedCursorRef.current !== undefined
      ? failedCursorRef.current
      : (current.questions.length === 0 ? null : current.nextCursor);
    if (cursorToRetry === null && current.questions.length > 0) return;
    await loadBatch(cursorToRetry, {
      isInitial: current.questions.length === 0,
      retry: true,
    });
  }, [loadBatch]);

  // Automatic background prefetch when user approaches the end of the loaded buffer.
  useEffect(() => {
    if (!activeScope || state.scope !== activeScope) return;
    if (!state.hasMore || !state.nextCursor || state.isFetchingMore || state.isInitialLoading || state.error) return;
    if (state.questions.length === 0) return;

    const triggerIndex = computePrefetchTriggerIndex(state.questions.length, prefetchThreshold);
    if (state.activeIndex >= triggerIndex) {
      void fetchNextBatch();
    }
  }, [
    activeScope,
    state.scope,
    state.activeIndex,
    state.questions.length,
    state.hasMore,
    state.nextCursor,
    state.isFetchingMore,
    state.isInitialLoading,
    state.error,
    prefetchThreshold,
    fetchNextBatch,
  ]);

  // Auto-recover failed batch fetches when connectivity returns.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      if (failedCursorRef.current !== undefined && scopeRef.current) {
        void retry();
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [retry]);

  const activeQuestion = state.questions[state.activeIndex];
  const activeQuestionKey = useMemo(
    () => (activeQuestion ? getQuestionKey(activeQuestion) : null),
    [activeQuestion, getQuestionKey],
  );

  const selectAnswer = useCallback((answer: TAnswer, questionOverride?: T) => {
    setState(prev => {
      const target = questionOverride ?? prev.questions[prev.activeIndex];
      const key = target ? getKeyRef.current(target) : null;
      if (!key) return prev;
      if (prev.answers[key] === answer) return prev;
      return {
        ...prev,
        answers: { ...prev.answers, [key]: answer },
      };
    });
  }, []);

  const clearAnswer = useCallback((questionOverride?: T) => {
    setState(prev => {
      const target = questionOverride ?? prev.questions[prev.activeIndex];
      const key = target ? getKeyRef.current(target) : null;
      if (!key || !(key in prev.answers)) return prev;
      const nextAnswers = { ...prev.answers };
      delete nextAnswers[key];
      return { ...prev, answers: nextAnswers };
    });
  }, []);

  const goTo = useCallback((index: number) => {
    setState(prev => {
      if (prev.questions.length === 0) return prev;
      const clamped = Math.max(0, Math.min(index, prev.questions.length - 1));
      if (clamped === prev.activeIndex) return prev;
      return { ...prev, activeIndex: clamped };
    });
  }, []);

  const next = useCallback(async () => {
    const current = stateRef.current;
    if (current.activeIndex < current.questions.length - 1) {
      goTo(current.activeIndex + 1);
      return;
    }
    if (current.hasMore && current.nextCursor) {
      const targetIndex = current.activeIndex + 1;
      await loadBatch(current.nextCursor, { isInitial: false, retry: Boolean(current.error) });
      setState(prev => (
        prev.questions.length > targetIndex ? { ...prev, activeIndex: targetIndex } : prev
      ));
    }
  }, [goTo, loadBatch]);

  const prev = useCallback(() => {
    setState(prevState => (
      prevState.activeIndex > 0 ? { ...prevState, activeIndex: prevState.activeIndex - 1 } : prevState
    ));
  }, []);

  return {
    questions: state.scope === activeScope ? state.questions : [],
    activeIndex: state.scope === activeScope ? state.activeIndex : 0,
    activeQuestion: state.scope === activeScope ? activeQuestion : undefined,
    activeAnswer: activeQuestionKey && state.scope === activeScope ? state.answers[activeQuestionKey] : undefined,
    answers: state.scope === activeScope ? state.answers : ({} as Record<string, TAnswer>),
    hasMore: state.scope === activeScope ? state.hasMore : false,
    nextCursor: state.scope === activeScope ? state.nextCursor : null,
    totalCount: state.scope === activeScope ? state.totalCount : undefined,
    isInitialLoading: state.scope === activeScope ? state.isInitialLoading : false,
    isFetchingMore: state.scope === activeScope ? state.isFetchingMore : false,
    error: state.scope === activeScope ? state.error : null,
    selectAnswer,
    clearAnswer,
    goTo,
    next,
    prev,
    fetchNextBatch,
    retry,
  };
}
