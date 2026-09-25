import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchQuestions } from './questions';
const request = vi.hoisted(() => vi.fn());
vi.mock('@/shared/api/request', () => ({ request, requestResponse: vi.fn() }));
const word = (id: string) => ({ id, questionType: 'study-mode', word: id, meanings: [] });
beforeEach(() => request.mockReset());

describe('study library pagination', () => {
  it('loads all pages for stable study numbering without requesting totals', async () => {
    request.mockResolvedValueOnce({ questions: [word('a')], hasMore: true, nextCursor: 'next' })
      .mockResolvedValueOnce({ questions: [word('b')], hasMore: false });
    expect((await fetchQuestions({ topic: 'words', questionType: 'study-mode' })).map(q => q.id)).toEqual(['a', 'b']);
    const first = new URL(request.mock.calls[0][0], 'http://localhost');
    expect(first.searchParams.get('pagination')).toBe('cursor');
    expect(first.searchParams.get('limit')).toBe('200');
    expect(first.searchParams.get('includeTotal')).toBe('false');
    expect(request.mock.calls[1][0]).toContain('cursor=next');
  });
  it('honors a caller limit without downloading the entire library', async () => {
    request.mockResolvedValue({ questions: [word('a')], hasMore: true, nextCursor: 'next' });
    expect(await fetchQuestions({ topic: 'words', questionType: 'study-mode', limit: 1 })).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1);
  });
  it('rejects a repeated cursor instead of looping forever', async () => {
    request.mockResolvedValue({ questions: [word('a')], hasMore: true, nextCursor: 'repeat' });
    await expect(fetchQuestions({ questionType: 'study-mode' })).rejects.toThrow('Invalid question pagination');
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not return a silently truncated library after a failed page', async () => {
    request.mockResolvedValueOnce({ questions: [word('a')], hasMore: true, nextCursor: 'next' }).mockRejectedValueOnce(new Error('offline'));
    await expect(fetchQuestions({ questionType: 'study-mode' })).rejects.toThrow('offline');
  });
});
