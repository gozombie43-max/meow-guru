import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useMockTranslation } from './useMockTranslation';

const translate = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ translate }) }));
beforeEach(() => translate.mockReset());
afterEach(cleanup);

it('renders authoritative Bengali question and options without calling translation', async () => {
  const question = { id: 'bilingual', question: 'English question', options: ['A', 'B', 'C', 'D'], translations: {
    question: { en: 'English question', bn: 'প্রদত্ত বাংলা প্রশ্ন' },
    options: { en: ['A', 'B', 'C', 'D'], bn: ['এক', 'দুই', 'তিন', 'চার'] },
  } };
  const { result, rerender } = renderHook(({ lang }) => useMockTranslation(question, '', lang), { initialProps: { lang: 'en' } });
  await act(async () => rerender({ lang: 'bn' }));
  expect(result.current.texts).toEqual(['প্রদত্ত বাংলা প্রশ্ন', 'এক', 'দুই', 'তিন', 'চার']);
  expect(result.current.pending).toBe(false);
  expect(translate).not.toHaveBeenCalled();
});

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
