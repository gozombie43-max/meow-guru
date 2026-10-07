import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useAdminQuestionBank } from './useAdminQuestionBank';
const fetch = vi.hoisted(() => vi.fn());
vi.mock('@/features/quiz/api/questionWrites', () => ({ questionWriteResponse: fetch }));
vi.mock('@/shared/api/client', () => ({ getAccessToken: () => null }));
vi.mock('./useQuestionUploads', () => ({ useQuestionUploads: () => ({}) }));
beforeEach(() => fetch.mockReset());

it('pages on the server and resets to page one for a debounced search', async () => {
  fetch.mockImplementation(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams;
    return { ok: true, json: async () => ({
      questions: [{ id: params.get('cursor') === 'page-two' ? 'q51' : 'q1' }], count: 123, total: 123, nextCursor: 'page-two', prevCursor: 'page-one',
      facets: { topics: ['algebra', 'geometry'], exams: ['SSC CGL'], quizNames: ['PYQ'] },
    }) };
  });
  const { result } = renderHook(useAdminQuestionBank);
  await waitFor(() => expect(result.current.questions[0]?.id).toBe('q1'));
  expect(result.current.totalPages).toBe(3);
  expect(result.current.totalCount).toBe(123);
  expect(fetch.mock.calls[0][0]).toContain('limit=50');
  act(() => result.current.setPage(2));
  await waitFor(() => expect(result.current.questions[0]?.id).toBe('q51'));
  expect(result.current.paginated).toHaveLength(1);
  act(() => { result.current.setSearch('equation'); result.current.setSortOrder('desc'); });
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
  const query = new URL(fetch.mock.calls[2][0], 'http://localhost').searchParams;
  expect(query.has('offset')).toBe(false);
  expect(query.get('pagination')).toBe('cursor');
  expect(query.has('cursor')).toBe(false);
  expect(query.get('search')).toBe('equation');
  expect(query.get('sort')).toBe('desc');
  expect(result.current.topics).toEqual(['algebra', 'geometry']);
});

it('filters out reasoning and english topics when subject is mathematics, and resets invalid topic', async () => {
  fetch.mockImplementation(async (url: string) => {
    const params = new URL(url, 'http://localhost').searchParams;
    const subject = params.get('subject');
    return {
      ok: true,
      json: async () => ({
        questions: [{ id: 'q1', subject: subject || 'all' }],
        count: 10,
        total: 10,
        facets: {
          topics: subject === 'mathematics'
            ? ['algebra', 'geometry']
            : ['algebra', 'analogy', 'blood-relations', 'geometry', 'synonyms-antonyms'],
          exams: ['SSC CGL'],
          quizNames: ['PYQ'],
        },
      }),
    };
  });

  const { result } = renderHook(useAdminQuestionBank);
  await waitFor(() => expect(result.current.questions[0]?.id).toBe('q1'));

  // Initial load without subject filter shows all topics
  expect(result.current.topics).toEqual([
    'algebra',
    'analogy',
    'blood-relations',
    'geometry',
    'synonyms-antonyms',
  ]);

  // Select a reasoning topic first
  act(() => {
    result.current.setFilterTopic('analogy');
  });
  expect(result.current.filterTopic).toBe('analogy');

  // Change subject to mathematics: topic should automatically reset because analogy is not a math topic
  act(() => {
    result.current.setFilterSubject('mathematics');
  });

  expect(result.current.filterSubject).toBe('mathematics');
  expect(result.current.filterTopic).toBe('');

  // topics should now only include mathematics topics, excluding analogy, blood-relations, synonyms-antonyms
  expect(result.current.topics).toEqual(['algebra', 'geometry']);

  // Verify fetch was called with subject=mathematics
  await waitFor(() => {
    const latestCall = fetch.mock.calls.at(-1)?.[0];
    const query = new URL(latestCall, 'http://localhost').searchParams;
    expect(query.get('subject')).toBe('mathematics');
  });
});

