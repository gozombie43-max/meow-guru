import { act, renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { useQuestionBuffer, type QuestionBatchResult } from '../useQuestionBuffer';
import { useQuizPrefetch } from '../useQuizPrefetch';
import { QuizLruCache } from '../../model/quizLruCache';
import { DEFAULT_PREFETCH_THRESHOLD, DEFAULT_QUIZ_BATCH_SIZE } from '../../model/constants';
import { ensureUniqueQuestionIds } from '../../model/utils';
import type { QuizQuestionRecord } from '../../model/types';
import { createCoalescedSave } from '@/lib/coalesced-save';
import { useQuizSession } from '@/hooks/useQuizSession';
import {
  createQuizSession,
  fetchSessionQuestionsBatch,
  getQuizSession,
  getQuizSessionResult,
  submitQuizSession,
  submitSessionAnswer,
} from '../../api/quizSessionApi';
import { createResumeSaver } from '../../model/resumeDelta';
import { useTranslation } from '@/hooks/useTranslation';

const mocks = vi.hoisted(() => ({
  fetchWithRetry: vi.fn(),
  request: vi.fn(),
  requestResponse: vi.fn(),
  submitQuizAnswer: vi.fn(),
  saveRecentQuiz: vi.fn(),
}));

vi.mock('@/lib/api/http', () => ({ fetchWithRetry: mocks.fetchWithRetry }));
vi.mock('@/shared/api/request', () => ({
  request: mocks.request,
  requestResponse: mocks.requestResponse,
}));
vi.mock('@/lib/userApi', () => ({
  submitQuizAnswer: mocks.submitQuizAnswer,
  saveRecentQuiz: mocks.saveRecentQuiz,
  prefetchQuestionReveals: vi.fn(),
}));
vi.mock('@/lib/axios', () => ({
  getAccessToken: () => 'test-token',
  AUTH_TOKEN_CHANGED_EVENT: 'auth-token-changed',
}));

type TestQuestion = {
  id: string;
  questionUid: string;
  question: string;
  options: string[];
};

function makeBatch(start: number, count: number, nextCursor: string | null): QuestionBatchResult<TestQuestion> {
  return {
    questions: Array.from({ length: count }, (_, i) => ({
      id: `q-${start + i}`,
      questionUid: `uid-${start + i}`,
      question: `Question ${start + i}`,
      options: ['A', 'B', 'C', 'D'],
    })),
    nextCursor,
    hasMore: Boolean(nextCursor),
    totalCount: 75,
  };
}

function makeRecord(id: string, overrides: Partial<QuizQuestionRecord> = {}): QuizQuestionRecord {
  return {
    id,
    questionUid: `uid-${id}`,
    concept: 'Algebra',
    formula: '',
    question: `Question ${id}`,
    options: ['A', 'B', 'C', 'D'],
    correctAnswer: -1,
    answer: '',
    difficulty: 'medium',
    estimatedTime: 60,
    year: '2025',
    exam: 'SSC CGL',
    solution: '',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useQuestionBuffer — batching, prefetching, dedupe, abort & recovery', () => {
  it('fetches a 25-question initial batch and prefetches around Q19 (6 remaining) without duplicate fetches', async () => {
    const fetchBatch = vi.fn(async ({ cursor, batchSize }: { cursor: string | null; batchSize: number; signal: AbortSignal }) => {
      if (cursor === null) return makeBatch(1, batchSize, 'cursor-2');
      if (cursor === 'cursor-2') return makeBatch(26, batchSize, 'cursor-3');
      return makeBatch(51, batchSize, null);
    });

    const { result } = renderHook(() =>
      useQuestionBuffer<TestQuestion, number>({
        queryKey: 'math:algebra:concept',
        fetchBatch,
      }),
    );

    await waitFor(() => expect(result.current.questions).toHaveLength(DEFAULT_QUIZ_BATCH_SIZE));
    expect(fetchBatch).toHaveBeenCalledTimes(1);
    expect(fetchBatch).toHaveBeenCalledWith(expect.objectContaining({ cursor: null, batchSize: 25 }));

    // Navigating up to index 18 (Q19 of 25, 7 left) stays inside the initial batch without triggering prefetch yet.
    act(() => result.current.goTo(18));
    expect(fetchBatch).toHaveBeenCalledTimes(1);

    // Reaching index 19 (25 - 6 = 19) triggers background prefetch for batch 2 automatically.
    act(() => result.current.goTo(DEFAULT_QUIZ_BATCH_SIZE - DEFAULT_PREFETCH_THRESHOLD));
    await waitFor(() => expect(result.current.questions).toHaveLength(50));
    expect(fetchBatch).toHaveBeenCalledTimes(2);
    expect(fetchBatch).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'cursor-2', batchSize: 25 }));

    // Navigating backward and forward across already-loaded indices never refetches batch 1 or batch 2.
    act(() => result.current.goTo(5));
    act(() => result.current.goTo(20));
    expect(fetchBatch).toHaveBeenCalledTimes(2);
  });

  it('triggers background prefetch around Q15 of a 20-question batch with tunable threshold', async () => {
    const fetchBatch = vi.fn(async ({ cursor, batchSize }: { cursor: string | null; batchSize: number; signal: AbortSignal }) => {
      if (cursor === null) return makeBatch(1, batchSize, 'batch-2');
      return makeBatch(21, batchSize, null);
    });

    const { result } = renderHook(() =>
      useQuestionBuffer<TestQuestion, number>({
        queryKey: 'math:geometry:20',
        fetchBatch,
        batchSize: 20,
        prefetchThreshold: 6,
      }),
    );

    await waitFor(() => expect(result.current.questions).toHaveLength(20));
    act(() => result.current.goTo(13)); // Q14 (index 13) -> before trigger
    expect(fetchBatch).toHaveBeenCalledTimes(1);

    act(() => result.current.goTo(14)); // Q15 (index 14 = 20 - 6) -> triggers background prefetch!
    await waitFor(() => expect(result.current.questions).toHaveLength(40));
    expect(fetchBatch).toHaveBeenCalledTimes(2);
  });

  it('deduplicates concurrent fetches for the same cursor and drops duplicate questions canonically', async () => {
    let resolvePage2!: (value: QuestionBatchResult<TestQuestion>) => void;
    const fetchBatch = vi.fn(({ cursor }: { cursor: string | null; batchSize: number; signal: AbortSignal }) => {
      if (cursor === null) {
        return Promise.resolve({
          questions: [
            { id: '1', questionUid: 'uid-1', question: 'Q1', options: ['A', 'B'] },
            { id: '1-dup', questionUid: 'uid-1', question: 'Q1 duplicate', options: ['A', 'B'] },
            { id: '2', questionUid: 'uid-2', question: 'Q2', options: ['A', 'B'] },
          ],
          nextCursor: 'c2',
          hasMore: true,
        });
      }
      return new Promise<QuestionBatchResult<TestQuestion>>(resolve => {
        resolvePage2 = resolve;
      });
    });

    const { result } = renderHook(() =>
      useQuestionBuffer<TestQuestion, number>({
        queryKey: 'dedupe-test',
        fetchBatch,
        batchSize: 25,
        prefetchThreshold: 1,
      }),
    );

    await waitFor(() => expect(result.current.questions).toHaveLength(2));
    expect(result.current.questions.map(q => q.questionUid)).toEqual(['uid-1', 'uid-2']);

    // Fire 3 concurrent requests for cursor 'c2' — only 1 network request must execute.
    let pending!: Promise<void[]>;
    act(() => {
      pending = Promise.all([
        result.current.fetchNextBatch(),
        result.current.fetchNextBatch(),
        result.current.fetchNextBatch(),
      ]);
    });
    expect(fetchBatch).toHaveBeenCalledTimes(2);

    // Return an overlapping question (`uid-2`) plus a new one (`uid-3`).
    await act(async () => {
      resolvePage2({
        questions: [
          { id: '2-overlap', questionUid: 'uid-2', question: 'Overlap Q2', options: ['A', 'B'] },
          { id: '3', questionUid: 'uid-3', question: 'Q3', options: ['A', 'B'] },
        ],
        nextCursor: null,
        hasMore: false,
      });
      await pending;
    });

    expect(result.current.questions.map(q => q.questionUid)).toEqual(['uid-1', 'uid-2', 'uid-3']);
  });

  it('aborts in-flight requests on filter/queryKey switch and on unmount', async () => {
    const signals: AbortSignal[] = [];
    const fetchBatch = vi.fn(({ signal }: { cursor: string | null; batchSize: number; signal: AbortSignal }) => {
      signals.push(signal);
      return new Promise<QuestionBatchResult<TestQuestion>>(() => {});
    });

    const { rerender, unmount } = renderHook(
      ({ queryKey }) => useQuestionBuffer<TestQuestion, number>({ queryKey, fetchBatch }),
      { initialProps: { queryKey: 'math:algebra' } },
    );

    await waitFor(() => expect(signals).toHaveLength(1));
    expect(signals[0].aborted).toBe(false);

    // Filter switch aborts the obsolete algebra request and starts geometry.
    rerender({ queryKey: 'math:geometry' });
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);

    // Unmount aborts the geometry request cleanly.
    unmount();
    expect(signals[1].aborted).toBe(true);
  });

  it('retains loaded questions and local answers on network error and retries only the failed batch', async () => {
    let failOnce = true;
    const fetchBatch = vi.fn(async ({ cursor }: { cursor: string | null; batchSize: number; signal: AbortSignal }) => {
      if (cursor === null) return makeBatch(1, 5, 'cursor-2');
      if (failOnce) {
        failOnce = false;
        throw new Error('Network disconnected');
      }
      return makeBatch(6, 5, null);
    });

    const { result } = renderHook(() =>
      useQuestionBuffer<TestQuestion, number>({
        queryKey: 'offline-recovery',
        fetchBatch,
        batchSize: 5,
        prefetchThreshold: 1,
      }),
    );

    await waitFor(() => expect(result.current.questions).toHaveLength(5));

    // User selects answers locally before a network outage hits batch 2.
    act(() => result.current.selectAnswer(2));
    expect(result.current.activeAnswer).toBe(2);

    // Advance to last loaded item -> triggers batch 2 -> fails.
    act(() => result.current.goTo(4));
    await waitFor(() => expect(result.current.error?.message).toBe('Network disconnected'));

    // Buffered questions and local answers remain completely intact!
    expect(result.current.questions).toHaveLength(5);
    expect(result.current.answers['uid:uid-1']).toBe(2);

    // Explicit retry fetches ONLY cursor-2 (never re-fetches initial batch).
    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.error).toBeNull();
    expect(result.current.questions).toHaveLength(10);
    expect(result.current.answers['uid:uid-1']).toBe(2);
    expect(fetchBatch.mock.calls.map(c => c[0].cursor)).toEqual([null, 'cursor-2', 'cursor-2']);
  });

  it('uses seeded initialBatch with 0 initial fetches across mount, null->sessionId transition, and inline rerenders', async () => {
    const seed = makeBatch(1, 25, 'cursor-2');
    let resolvePage2!: (value: QuestionBatchResult<TestQuestion>) => void;
    let page2Signal: AbortSignal | undefined;
    const fetchBatch = vi.fn(({ signal }: { cursor: string | null; batchSize: number; signal: AbortSignal }) => {
      page2Signal = signal;
      return new Promise<QuestionBatchResult<TestQuestion>>(resolve => {
        resolvePage2 = resolve;
      });
    });

    // 1. Mount with seeded initialBatch -> 0 initial fetches.
    const mounted = renderHook(
      ({ inlineAnswers }) =>
        useQuestionBuffer<TestQuestion, number>({
          queryKey: 'sess_seeded_1',
          fetchBatch,
          initialBatch: seed,
          initialAnswers: inlineAnswers,
        }),
      { initialProps: { inlineAnswers: { 'uid:uid-1': 1 } } },
    );

    expect(mounted.result.current.questions).toHaveLength(25);
    expect(fetchBatch).not.toHaveBeenCalled();

    // Start fetching batch 2, then rerender with fresh inline answers object -> must NOT abort batch 2!
    let pendingNext!: Promise<void>;
    act(() => {
      pendingNext = mounted.result.current.fetchNextBatch();
    });
    expect(fetchBatch).toHaveBeenCalledTimes(1);
    expect(page2Signal?.aborted).toBe(false);

    mounted.rerender({ inlineAnswers: { 'uid:uid-1': 1 } });
    expect(page2Signal?.aborted).toBe(false);

    await act(async () => {
      resolvePage2(makeBatch(26, 25, null));
      await pendingNext;
    });
    expect(mounted.result.current.questions).toHaveLength(50);
    mounted.unmount();

    // 2. Async null -> sessionId transition with initialBatch -> 0 initial fetches.
    fetchBatch.mockClear();
    const asyncSeed = makeBatch(1, 20, 'c2');
    const asyncHook = renderHook(
      ({ qKey, batch }) =>
        useQuestionBuffer<TestQuestion, number>({
          queryKey: qKey,
          fetchBatch,
          initialBatch: batch,
        }),
      { initialProps: { qKey: null as string | null, batch: null as QuestionBatchResult<TestQuestion> | null } },
    );
    expect(fetchBatch).not.toHaveBeenCalled();

    asyncHook.rerender({ qKey: 'sess_async_2', batch: asyncSeed });
    await waitFor(() => expect(asyncHook.result.current.questions).toHaveLength(20));
    expect(fetchBatch).not.toHaveBeenCalled();
  });
});

describe('useQuizSession & quiz utilities — dedupe, abort & error retry recovery', () => {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
  );

  it('deduplicates overlapping questions across pages and recovers from a failed tail page via retryFetchMore without refetching page 0', async () => {
    mocks.fetchWithRetry
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          questions: [
            { id: '1', questionUid: 'uid-1', question: 'Q1', options: ['A', 'B'] },
            { id: '2', questionUid: 'uid-2', question: 'Q2', options: ['A', 'B'] },
          ],
          nextCursor: 'cursor-2',
          hasMore: true,
        }),
      })
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          questions: [
            { id: '2-dup', questionUid: 'uid-2', question: 'Q2 overlap', options: ['A', 'B'] },
            { id: '3', questionUid: 'uid-3', question: 'Q3', options: ['A', 'B'] },
          ],
          nextCursor: null,
          hasMore: false,
        }),
      });

    const { result } = renderHook(
      () => useQuizSession({ subject: 'mathematics', topic: 'algebra' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.questions).toHaveLength(2));
    expect(mocks.fetchWithRetry.mock.calls[0][0]).toContain('limit=25');

    // Next page fails; loaded questions remain buffered and isError is set.
    await act(async () => {
      await result.current.fetchMore();
    });
    await waitFor(() => expect(result.current.isError).toBeTruthy());
    expect(result.current.questions.map(q => q.questionUid)).toEqual(['uid-1', 'uid-2']);

    // Explicit retryFetchMore retries ONLY page 2 (not page 0), clears error, and drops duplicate uid-2.
    await act(async () => {
      await result.current.retryFetchMore();
    });
    await waitFor(() => expect(result.current.questions).toHaveLength(3));
    expect(result.current.isError).toBeUndefined();
    expect(result.current.questions.map(q => q.questionUid)).toEqual(['uid-1', 'uid-2', 'uid-3']);
    expect(mocks.fetchWithRetry).toHaveBeenCalledTimes(3);
    expect(mocks.fetchWithRetry.mock.calls[1][0]).toContain('cursor=cursor-2');
    expect(mocks.fetchWithRetry.mock.calls[2][0]).toContain('cursor=cursor-2');
  });

  it('aborts in-flight session fetches when filters change', async () => {
    const signals: AbortSignal[] = [];
    mocks.fetchWithRetry.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.signal) signals.push(init.signal);
      return new Promise(() => {});
    });

    const { rerender, unmount } = renderHook(
      ({ exam }) => useQuizSession({ subject: 'mathematics', topic: 'algebra', exam }),
      { initialProps: { exam: 'SSC CGL' }, wrapper },
    );

    await waitFor(() => expect(signals).toHaveLength(1));
    expect(signals[0].aborted).toBe(false);

    rerender({ exam: 'SSC CHSL' });
    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);

    unmount();
    await act(async () => {
      await Promise.resolve();
    });
    expect(signals[1].aborted).toBe(true);
  });

  it('drops true canonical duplicates in ensureUniqueQuestionIds instead of minting fake IDs', () => {
    const q1 = makeRecord('10', { questionUid: 'uid-10' });
    const q1Duplicate = makeRecord('10', { questionUid: 'uid-10' });
    const q2 = makeRecord('11', { questionUid: 'uid-11' });
    const unique = ensureUniqueQuestionIds([q1, q1Duplicate, q2]);
    expect(unique).toHaveLength(2);
    expect(unique.map(q => q.id)).toEqual(['10', '11']);
  });

  it('triggers useQuizPrefetch using tunable threshold without calling pre-submission reveal APIs', () => {
    const fetchMore = vi.fn();
    const cache = new QuizLruCache(16);
    const questions = Array.from({ length: 20 }, (_, i) => makeRecord(String(i + 1)));

    const { rerender } = renderHook(
      ({ currentIndex }) =>
        useQuizPrefetch({
          started: true,
          showAnalytics: false,
          currentIndex,
          questions,
          hasMore: true,
          isFetchingMore: false,
          prefetchThreshold: 6,
          fetchMore,
          cache,
        }),
      { initialProps: { currentIndex: 13 } },
    );

    expect(fetchMore).not.toHaveBeenCalled();
    rerender({ currentIndex: 14 }); // Q15 of 20
    expect(fetchMore).toHaveBeenCalledTimes(1);
  });
});

describe('coalesced-save & resumeDelta backoff resilience', () => {
  it('preserves and flushes a newer pending snapshot when an in-flight write fails transiently', async () => {
    let rejectFirst!: (err: Error) => void;
    const write = vi
      .fn()
      .mockImplementationOnce(() => new Promise<void>((_res, rej) => { rejectFirst = rej; }))
      .mockResolvedValueOnce(undefined);

    const saver = createCoalescedSave<{ v: number }>(write, (a, b) => a.v === b.v);

    const p1 = saver.save({ v: 1 });
    // Newer state arrives while write(1) is still in flight.
    const p2 = saver.save({ v: 2 });
    rejectFirst(new Error('transient blip'));

    await Promise.all([p1, p2]);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls.map(c => c[0])).toEqual([{ v: 1 }, { v: 2 }]);
  });

  it('retries a stuck online answer automatically with bounded exponential backoff (2s -> 5s -> 15s)', async () => {
    vi.useFakeTimers();
    mocks.submitQuizAnswer
      .mockRejectedValueOnce(new Error('503'))
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce({ data: { correct: 1, isCorrect: true } });

    const saver = createResumeSaver('token', 'backoff-quiz');
    const onResolved = vi.fn();
    const snap = {
      quizKey: 'math:algebra',
      title: 'Algebra',
      subject: 'math',
      href: '/quiz',
      currentIndex: 0,
      selectedAnswers: { 0: 1 },
      submittedQuestions: [0],
      results: [{ questionIndex: 0, selected: 1, correct: -1, isCorrect: false }],
      status: 'in-progress' as const,
    };

    await expect(
      saver.answer(
        { questionId: 'q1', answer: 1, submissionId: 'sub_backoff_1', questionIndex: 0, timeTaken: 8 },
        snap,
        { onResolved },
      ),
    ).rejects.toThrow('503');

    expect(mocks.submitQuizAnswer).toHaveBeenCalledTimes(1);
    expect(onResolved).not.toHaveBeenCalled();

    // First backoff retry at 2s fails.
    await vi.advanceTimersByTimeAsync(2_000);
    expect(mocks.submitQuizAnswer).toHaveBeenCalledTimes(2);
    expect(onResolved).not.toHaveBeenCalled();

    // Second backoff retry at +5s succeeds and delivers the reveal.
    await vi.advanceTimersByTimeAsync(5_000);
    expect(mocks.submitQuizAnswer).toHaveBeenCalledTimes(3);
    expect(onResolved).toHaveBeenCalledWith({ correct: 1, isCorrect: true });

    saver.dispose();
  });

  it('recognizes Axios CanceledError / ERR_CANCELED in coalesced-save and resumeDelta without retrying', async () => {
    vi.useFakeTimers();
    const canceled = Object.assign(new Error('canceled'), { name: 'CanceledError', code: 'ERR_CANCELED' });
    const write = vi.fn().mockRejectedValueOnce(canceled);
    const coalesced = createCoalescedSave<{ v: number }>(write, (a, b) => a.v === b.v);
    const p1 = coalesced.save({ v: 1 });
    const p2 = coalesced.save({ v: 2 });
    await expect(Promise.all([p1, p2])).rejects.toThrow('canceled');
    expect(write).toHaveBeenCalledTimes(1);

    mocks.submitQuizAnswer.mockRejectedValueOnce(canceled);
    const saver = createResumeSaver('token', 'cancel-quiz');
    await expect(
      saver.answer(
        { questionId: 'q1', answer: 1, submissionId: 'sub_cancel_1', questionIndex: 0, timeTaken: 5 },
        {
          quizKey: 'math:cancel',
          title: 'Cancel',
          subject: 'math',
          href: '/quiz',
          currentIndex: 0,
          selectedAnswers: { 0: 1 },
          submittedQuestions: [0],
          results: [{ questionIndex: 0, selected: 1, correct: -1, isCorrect: false }],
          status: 'in-progress',
        },
      ),
    ).rejects.toThrow('canceled');
    await vi.advanceTimersByTimeAsync(20_000);
    expect(mocks.submitQuizAnswer).toHaveBeenCalledTimes(1);
    saver.dispose();
  });
});

describe('useTranslation shared-batch abort safety', () => {
  it('does not abort a shared batch when another caller still awaits a sibling key and settles aborted waiters immediately', async () => {
    let batchSignal: AbortSignal | undefined;
    let resolveFetch!: (value: Response) => void;
    mocks.requestResponse.mockImplementation((_url: string, init?: RequestInit) => {
      batchSignal = init?.signal ?? undefined;
      return new Promise<Response>(resolve => {
        resolveFetch = resolve;
      });
    });

    const callerA = renderHook(() => useTranslation());
    const callerB = renderHook(() => useTranslation());

    const controllerA = new AbortController();
    const controllerB = new AbortController();

    // Caller A starts a 2-key batch; Caller B joins on key 1 (`toFetch.length === 0`).
    let promiseA!: Promise<string[]>;
    let promiseB!: Promise<string[]>;
    act(() => {
      promiseA = callerA.result.current.translate(['Shared key alpha?', 'Sibling key beta?'], 'bn', false, controllerA.signal);
      promiseB = callerB.result.current.translate(['Shared key alpha?'], 'bn', false, controllerB.signal);
    });

    expect(mocks.requestResponse).toHaveBeenCalledTimes(1);
    expect(callerB.result.current.isTranslating).toBe(true);

    // Caller B aborts -> must settle immediately with source fallback and MUST NOT abort Caller A's batch!
    await act(async () => {
      controllerB.abort();
      const resB = await promiseB;
      expect(resB).toEqual(['Shared key alpha?']);
    });
    expect(callerB.result.current.isTranslating).toBe(false);
    expect(batchSignal?.aborted).toBe(false);

    // Caller A's batch completes normally!
    await act(async () => {
      resolveFetch(
        new Response(
          JSON.stringify([
            { translations: [{ text: 'bn:Shared key alpha?' }] },
            { translations: [{ text: 'bn:Sibling key beta?' }] },
          ]),
        ),
      );
      const resA = await promiseA;
      expect(resA).toEqual(['bn:Shared key alpha?', 'bn:Sibling key beta?']);
    });
    expect(callerA.result.current.isTranslating).toBe(false);
  });
});

describe('quizSessionApi — Zod runtime schema validation for /api/v1/quiz/sessions', () => {
  it('validates all six standardized v1 quiz session endpoints and enforces contracts/quiz-session.js bounds', async () => {
    mocks.request.mockResolvedValueOnce({
      sessionId: 'sess_123',
      mode: 'practice',
      status: 'in_progress',
      batchSize: 25,
      totalCount: 100,
      answeredCount: 0,
      questions: [
        { questionUid: 'q_abc', question: '2 + 2 = ?', options: ['3', '4', '5', '6'] },
        // Valid image_mcq DTO omitting text question/options defaults safely to '' / []
        { questionUid: 'q_img', questionType: 'image_mcq', questionImage: '/images/q.webp' },
      ],
      nextCursor: 'cur_2',
      hasMore: true,
      deadlineAt: null,
      revision: 1,
    });
    const created = await createQuizSession({
      mode: 'practice',
      subject: 'mathematics',
      topic: 'algebra',
      tier: 'Tier I',
      chapter: 'Linear',
      examMode: 'ssc',
      totalQuestions: 50,
      randomize: true,
      timeLimitSec: 1800,
    });
    expect(created.sessionId).toBe('sess_123');
    expect(created.batchSize).toBe(25);
    expect(created.questions[1]).toMatchObject({ questionUid: 'q_img', question: '', options: [] });
    expect(mocks.request).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/quiz/sessions'),
      expect.objectContaining({ method: 'POST' }),
    );

    // Reconnect endpoint: GET /api/v1/quiz/sessions/:id
    mocks.request.mockResolvedValueOnce({
      sessionId: 'sess_123',
      mode: 'practice',
      status: 'in_progress',
      answeredCount: 1,
      answeredQuestionUids: ['q_abc'],
      lastCursor: 'cur_2',
      deadlineAt: null,
      revision: 2,
      hasMore: true,
    });
    const reconnected = await getQuizSession('sess_123');
    expect(reconnected.answeredQuestionUids).toEqual(['q_abc']);
    expect(mocks.request).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/quiz/sessions/sess_123'),
      expect.objectContaining({ method: 'GET' }),
    );

    mocks.request.mockResolvedValueOnce({
      sessionId: 'sess_123',
      questions: [{ questionUid: 'q_def', question: '3 + 3 = ?', options: ['5', '6'] }],
      nextCursor: null,
      hasMore: false,
      batchNumber: 2,
      returnedCount: 1,
    });
    // Oversized batchSize clamps to V1_MAX_BATCH_SIZE (50).
    const batch = await fetchSessionQuestionsBatch('sess_123', { cursor: 'cur_2', batchSize: 99, lang: 'en' });
    expect(batch.batchNumber).toBe(2);
    expect(mocks.request).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/quiz/sessions/sess_123/questions?cursor=cur_2&batchSize=50&lang=en'),
      expect.objectContaining({ method: 'GET' }),
    );

    mocks.request.mockResolvedValueOnce({
      sessionId: 'sess_123',
      questionUid: 'q_abc',
      accepted: true,
      revision: 2,
      answeredCount: 1,
      evaluation: { isCorrect: true, correct: 1, solution: '2 + 2 = 4' },
    });
    const ans = await submitSessionAnswer(
      'sess_123',
      { questionUid: 'q_abc', answer: 1, timeTakenMs: 4200 },
      { idempotencyKey: 'key_12345678' },
    );
    expect(ans.accepted).toBe(true);
    expect(ans.evaluation?.correct).toBe(1);

    mocks.request.mockResolvedValueOnce({
      sessionId: 'sess_123',
      status: 'completed',
      result: { score: 2, maxScore: 2, accuracy: 100 },
    });
    const submitted = await submitQuizSession('sess_123', { reason: 'timeout' });
    expect(submitted.status).toBe('completed');
    expect(mocks.request).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/v1/quiz/sessions/sess_123/submit'),
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ reason: 'timeout' }) }),
    );

    mocks.request.mockResolvedValueOnce({
      sessionId: 'sess_123',
      mode: 'practice',
      status: 'completed',
      submittedAt: '2026-11-20T00:00:00Z',
      result: { score: 2 },
      review: [{ questionUid: 'q_abc', isCorrect: true }],
    });
    const res = await getQuizSessionResult('sess_123');
    expect(res.review).toHaveLength(1);

    // Enforces backend bounds: rejects batchSize > 50, totalQuestions > 200, invalid mode, and malformed response.
    await expect(createQuizSession({ mode: 'practice', batchSize: 51 })).rejects.toThrow();
    await expect(createQuizSession({ mode: 'practice', totalQuestions: 201 })).rejects.toThrow();
    await expect(createQuizSession({ mode: 'battle' as 'practice' })).rejects.toThrow();
    mocks.request.mockResolvedValueOnce({ questions: 'invalid' });
    await expect(createQuizSession({ mode: 'practice' })).rejects.toThrow();
  });
});
