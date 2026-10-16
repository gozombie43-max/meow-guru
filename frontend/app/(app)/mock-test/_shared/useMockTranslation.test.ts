import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMockTranslation } from './useMockTranslation';

const translate = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ translate }) }));
beforeEach(() => translate.mockReset());
afterEach(cleanup);

it('translates question and options while keeping English as the default', async () => {
  const question = { id: 'one', question: 'Choose a colour', options: ['Red', 'Blue'] };
  translate.mockResolvedValue(['एक रंग चुनें', 'लाल', 'नीला', '']);
  const { result, rerender } = renderHook(({ lang }) => useMockTranslation(question, 'General Awareness', lang), { initialProps: { lang: 'en' } });
  expect(translate).not.toHaveBeenCalled();
  await act(async () => rerender({ lang: 'hi' }));
  expect(result.current.texts.slice(0, 3)).toEqual(['एक रंग चुनें', 'लाल', 'नीला']);
  expect(result.current.pending).toBe(false);
});

it('ignores a late translation after moving to another question', async () => {
  let finishFirst!: (texts: string[]) => void;
  translate.mockImplementationOnce(() => new Promise<string[]>(resolve => { finishFirst = resolve; }));
  translate.mockResolvedValueOnce(['নতুন প্রশ্ন', '']);
  const { result, rerender } = renderHook(({ question }) => useMockTranslation(question, '', 'bn'), {
    initialProps: { question: { id: 'one', question: 'First question' } },
  });
  expect(result.current.pending).toBe(true);
  await act(async () => rerender({ question: { id: 'two', question: 'Next question' } }));
  await act(async () => finishFirst(['পুরনো প্রশ্ন', '']));
  expect(result.current.texts[0]).toBe('নতুন প্রশ্ন');
});
