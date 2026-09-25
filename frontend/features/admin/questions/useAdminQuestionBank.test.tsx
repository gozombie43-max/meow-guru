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
      questions: [{ id: params.get('offset') === '50' ? 'q51' : 'q1' }], count: 123,
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
  expect(query.get('offset')).toBe('0');
  expect(query.get('search')).toBe('equation');
  expect(query.get('sort')).toBe('desc');
  expect(result.current.topics).toEqual(['algebra', 'geometry']);
});
