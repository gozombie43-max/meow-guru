import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useStudyModeComparisonController } from './useStudyModeComparisonController';
import type { StudyModeComparisonConfig } from './study-mode-comparison-model';
const data = vi.hoisted(() => ({ questions: [
  { id: 'a', word: 'Able', meanings: [{ definition: 'Having skill', translation: 'সক্ষম' }], synonyms: [{ word: 'Capable' }] },
  { id: 'b', word: 'Bold', meanings: [{ definition: 'Showing courage' }], antonyms: [{ word: 'Timid' }] },
  { id: 'c', word: 'Calm', meanings: [{ definition: 'Not agitated' }] },
], isLoading: false, isError: null, mutate: vi.fn() }));
const request = vi.hoisted(() => vi.fn());
vi.mock('@/hooks/useQuestions', () => ({ useQuestions: () => data }));
vi.mock('@/hooks/useAppNavigation', () => ({ useAppNavigation: () => ({ replace: vi.fn() }), useBackLayer: vi.fn() }));
vi.mock('@/hooks/useTheme', () => ({ useThemeMode: () => ({ theme: 'light', setThemeMode: vi.fn() }) }));
vi.mock('@/shared/api/request', () => ({ requestResponse: request }));
vi.mock('@/shared/api/client', () => ({ getAccessToken: () => 'token' }));
const config: StudyModeComparisonConfig = { topic: 'synonyms-antonyms', primaryField: 'synonyms', secondaryField: 'antonyms', primaryLabel: 'Synonyms', secondaryLabel: 'Antonyms', primaryTitle: 'SYNONYMS', secondaryTitle: 'ANTONYMS', primaryEmptyLabel: 'No synonyms', secondaryEmptyLabel: 'No antonyms', demoCard: { id: 'demo', word: 'Demo', meanings: [], primaryItems: [], secondaryItems: [] } };
afterEach(() => { cleanup(); request.mockReset(); });

describe('comparison study controller', () => {
  it('keeps normalized cards stable across control changes and preserves the selected tab', () => {
    const { result } = renderHook(() => useStudyModeComparisonController(config));
    const cards = result.current.cards;
    act(() => { result.current.setMobileTab('secondary'); result.current.setCurrentPage(2); });
    expect(result.current.cards).toBe(cards);
    expect(result.current.currentPage).toBe(2);
    expect(result.current.mobileTab).toBe('secondary');
    expect(result.current.theme).toBe('light');
  });
  it('searches meanings and related words, with genuine empty results', () => {
    const { result } = renderHook(() => useStudyModeComparisonController(config));
    act(() => result.current.setSearchQuery('capable'));
    expect(result.current.filteredCards.map(card => card.word)).toEqual(['Able']);
    act(() => result.current.setSearchQuery('missing'));
    expect(result.current.filteredCards).toEqual([]);
  });
  it('selects the correct palette word after desktop filtering', () => {
    const { result } = renderHook(() => useStudyModeComparisonController(config));
    act(() => result.current.setSelectedLetter('A'));
    act(() => result.current.selectCard('c'));
    expect(result.current.selectedLetter).toBeNull();
    expect(result.current.filteredCards[result.current.currentPage - 1].id).toBe('c');
  });
  it('does not navigate words when arrow keys are used in a search field', () => {
    const { result } = renderHook(() => useStudyModeComparisonController(config));
    const input = document.createElement('input'); document.body.append(input);
    act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })));
    expect(result.current.currentPage).toBe(1); input.remove();
  });
  it('aborts stale pronunciation on a new word and on navigation', async () => {
    const pending: Array<(response: Response) => void> = [];
    request.mockImplementation(() => new Promise<Response>(resolve => pending.push(resolve)));
    const { result } = renderHook(() => useStudyModeComparisonController(config));
    let first!: Promise<void>; let second!: Promise<void>;
    act(() => { first = result.current.handleRowClick('Able'); });
    const firstSignal = request.mock.calls[0][1].signal as AbortSignal;
    act(() => { second = result.current.handleRowClick('Bold'); });
    expect(firstSignal.aborted).toBe(true);
    const secondSignal = request.mock.calls[1][1].signal as AbortSignal;
    act(() => result.current.setCurrentPage(2));
    expect(secondSignal.aborted).toBe(true);
    await act(async () => { pending.forEach(resolve => resolve(new Response('audio'))); await Promise.all([first, second]); });
    expect(result.current.activeSpeech).toBeNull();
  });
});
