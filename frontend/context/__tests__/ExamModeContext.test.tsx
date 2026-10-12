import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { ExamModeProvider, useExamMode } from '../ExamModeContext';
import { EXAM_MODE_KEY } from '@/lib/exam-mode';
beforeEach(() => localStorage.clear());
afterEach(cleanup);
it('defaults to SSC and persists both directions across remounts', () => {
  const first = renderHook(useExamMode, { wrapper: ExamModeProvider });
  expect(first.result.current.mode).toBe('ssc');
  act(() => first.result.current.setMode('iit-jam'));
  expect(first.result.current.isJam).toBe(true);
  expect(localStorage.getItem(EXAM_MODE_KEY)).toBe('iit-jam');
  first.unmount();
  const second = renderHook(useExamMode, { wrapper: ExamModeProvider });
  expect(second.result.current.isJam).toBe(true);
  act(() => second.result.current.setMode('ssc'));
  expect(second.result.current.isJam).toBe(false);
  expect(localStorage.getItem(EXAM_MODE_KEY)).toBe('ssc');
});
it('syncs mode changes from another tab and ignores invalid stored values', () => {
  localStorage.setItem(EXAM_MODE_KEY, 'invalid');
  const { result } = renderHook(useExamMode, { wrapper: ExamModeProvider });
  expect(result.current.mode).toBe('ssc');
  act(() => { localStorage.setItem(EXAM_MODE_KEY, 'iit-jam'); window.dispatchEvent(new StorageEvent('storage', { key: EXAM_MODE_KEY })); });
  expect(result.current.isJam).toBe(true);
});
