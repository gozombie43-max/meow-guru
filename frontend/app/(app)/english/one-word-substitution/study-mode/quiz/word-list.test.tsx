import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WordList } from './word-list';

const speak = vi.hoisted(() => vi.fn());
vi.mock('../../../_shared/SpeakerBtn', () => ({ SpeakerBtn: (props: {text: string}) => { speak(props.text); return <button aria-label="Speak" />; } }));
const cards = Array.from({ length: 1000 }, (_, index) => ({ id: String(index), answer: `Word ${index}`, prompt: 'A definition.' }));
let intersect: IntersectionObserverCallback;
beforeEach(() => {
  speak.mockClear();
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { intersect = callback; }
    observe() {} disconnect() {}
  });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('study word rendering', () => {
  it('keeps initial rendering small and progressively reveals a large library', () => {
    render(<WordList cards={cards} saved={new Set()} translations storageReady toggleSave={vi.fn()} />);
    expect(screen.getAllByRole('article')).toHaveLength(40);
    act(() => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getAllByRole('article')).toHaveLength(80);
    fireEvent.click(screen.getByRole('button', { name: 'Show more words' }));
    expect(screen.getAllByRole('article')).toHaveLength(120);
  });
  it('rerenders only the changed card when saving a word', () => {
    const toggleSave = vi.fn();
    const { rerender } = render(<WordList cards={cards} saved={new Set()} translations storageReady toggleSave={toggleSave} />);
    speak.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Save Word 0' }));
    expect(toggleSave).toHaveBeenCalledWith('0');
    rerender(<WordList cards={cards} saved={new Set(['0'])} translations storageReady toggleSave={toggleSave} />);
    expect(speak).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Unsave Word 0' })).toHaveAttribute('aria-pressed', 'true');
  });
});
