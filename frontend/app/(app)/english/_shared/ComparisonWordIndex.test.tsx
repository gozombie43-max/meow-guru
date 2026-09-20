import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ComparisonWordIndex } from './ComparisonWordIndex';
const cards = Array.from({ length: 2000 }, (_, i) => ({ id: String(i), word: `Word ${i}`, meanings: [], primaryItems: [], secondaryItems: [] }));
beforeEach(() => { vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('renders a bounded window and reaches words far down the index', () => {
  const onSelect = vi.fn();
  const { container } = render(<ComparisonWordIndex cards={cards} onSelect={onSelect} compact />);
  expect(screen.getAllByRole('button').length).toBeLessThan(40);
  const scroll = container.firstElementChild as HTMLElement;
  act(() => { scroll.scrollTop = 1000 * 48; fireEvent.scroll(scroll); });
  fireEvent.click(screen.getByRole('button', { name: 'Word 1000' }));
  expect(onSelect).toHaveBeenCalledWith('1000');
  expect(screen.getAllByRole('button').length).toBeLessThan(40);
});
it('preserves original word numbering after filtering', () => {
  const numbers = new Map(cards.map((card, index) => [card.id, index + 1]));
  render(<ComparisonWordIndex cards={[cards[999]]} numbers={numbers} onSelect={vi.fn()} />);
  expect(screen.getByText('1000')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Word 999' })).toBeInTheDocument();
});
