import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import ApplicationProviders from '@/app/providers';
import { useQuestionCounts } from './useQuestionCounts';
import { useQuizFilters } from '@/features/quiz/hooks/useQuizFilters';
import type { SubjectConfig } from '@/features/quiz/model/types';

const mocks = vi.hoisted(() => ({ loading: true, user: null as null | { id: string; recentQuizzes?: Record<string, unknown>[] }, fetch: vi.fn() }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ loading: mocks.loading, user: mocks.user }) }));
vi.mock('@/lib/api/http', () => ({ fetchWithRetry: mocks.fetch }));
const config: SubjectConfig = { subjectId: 'mathematics', subjectLabel: 'Mathematics', cssClassName: 'math',
  topicConcepts: {}, classificationCategories: [], getClassificationCategoryId: () => 'all' };
const wrapper = ({ children }: { children: ReactNode }) => <ApplicationProviders>{children}</ApplicationProviders>;
beforeEach(() => {
  mocks.loading = true; mocks.user = null; mocks.fetch.mockReset();
  mocks.fetch.mockImplementation(async (url: string) => ({ ok: true, json: async () => url.includes('/meta?')
    ? { total: 1, exams: [], concepts: [], letters: {} }
    : url.includes('/session?') ? { questions: [{ id: 'q1', question: '2+2?', options: ['4'], correctAnswer: 0 }], hasMore: false, nextCursor: null }
      : { concept: 1, formula: 0, mixed: 0, aiChallenge: 0, easy: 0, hard: 0, studyMode: 0 } }));
});

describe('public quiz queries during auth restoration', () => {
  it('loads counts before auth and preserves the request when the first owner becomes ready', async () => {
    const { result, rerender } = renderHook(() => useQuestionCounts({ topic: 'percentages' }), { wrapper });
    await waitFor(() => expect(result.current.counts.concept).toBe(1));
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining('/counts?'), {}, { auth: 'none' });
    mocks.loading = false; mocks.user = { id: 'first' }; rerender();
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('starts fresh metadata and session reads before auth, without repeating them after restoration', async () => {
    const { result, rerender } = renderHook(() => useQuizFilters({ subjectConfig: config, slug: 'percentages', mode: 'concept', initialLetterParam: null }), { wrapper });
    await waitFor(() => expect(result.current.questions).toHaveLength(1));
    expect(result.current.isLoading).toBe(true); // Data can arrive before private actions become ready.
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    for (const call of mocks.fetch.mock.calls) expect(call.slice(1)).toEqual([{}, { auth: 'none' }]);
    mocks.loading = false; mocks.user = { id: 'first' }; rerender();
    expect(mocks.fetch).toHaveBeenCalledTimes(2);
    expect(result.current.isLoading).toBe(false);
  });
  it('loads public metadata early but waits for saved filters and anchor before the first resume window', async () => {
    const { rerender } = renderHook(() => useQuizFilters({ subjectConfig: config, slug: 'percentages', mode: 'concept', initialLetterParam: null, resumeRequested: true }), { wrapper });
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(1));
    expect(mocks.fetch.mock.calls[0][0]).toContain('/meta?');
    mocks.user = { id: 'first', recentQuizzes: [{ quizKey: 'mathematics:percentages', status: 'active', currentIndex: 240,
      questionAnchor: '507f1f77bcf86cd799439011', sessionFilters: { concept: 'Ratio', letter: 'A' } }] };
    mocks.loading = false; rerender();
    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledTimes(2));
    const url = new URL(mocks.fetch.mock.calls[1][0], 'http://localhost');
    expect(url.searchParams.get('resumeIndex')).toBe('240');
    expect(url.searchParams.get('anchor')).toBe('507f1f77bcf86cd799439011');
    expect(url.searchParams.get('concept')).toBe('Ratio');
    expect(url.searchParams.get('letter')).toBe('A');
  });
});
