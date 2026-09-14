import { renderHook, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuestions } from './useQuestions';
import { questionKey } from '@/features/quiz/api/questions';

const transport = vi.hoisted(() => vi.fn());
vi.mock('@/shared/api/request', () => ({ request: transport }));
beforeEach(() => transport.mockReset());

describe('question queries', () => {
  it('shares one request for equivalent study-mode consumers and filters the response', async () => {
    transport.mockResolvedValue({ questions: [{ id: 'study', questionType: 'study-mode' }, { id: 'quiz', questionType: 'concept' }] });
    const cache = new Map();
    const { result } = renderHook(() => ({
      first: useQuestions({ subject: 'english', topic: 'words', questionType: 'studymode' }),
      second: useQuestions({ subject: 'english', topic: 'words', questionType: 'study-mode' }),
    }), { wrapper: ({ children }) => <SWRConfig value={{ provider: () => cache }}>{children}</SWRConfig> });
    await waitFor(() => expect(result.current.first.questions).toHaveLength(1));
    expect(result.current.second.questions?.[0].id).toBe('study');
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('separates all filter and pagination inputs, including zero offsets', () => {
    const base = { topic: 'algebra', subject: 'math', difficulty: 'easy', quizName: 'drill', questionType: 'all', limit: 50, offset: 0 };
    for (const [key, value] of Object.entries(base)) {
      const changed = { ...base, [key]: typeof value === 'number' ? value + 1 : `${value}-other` };
      expect(questionKey(changed)).not.toBe(questionKey(base));
    }
    expect(questionKey(base)).toContain('offset=0');
  });
});
