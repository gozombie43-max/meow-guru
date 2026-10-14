import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import MobileHeroCarousel from './MobileHeroCarousel.client';

const media = vi.hoisted(() => ({ reduced: false, desktop: false }));
vi.mock('@/hooks/useMediaQuery', () => ({ useMediaQuery: (query: string) => query.includes('reduced-motion') ? media.reduced : media.desktop }));
vi.mock('next/image', () => ({ default: ({ src, alt, className }: { src: string; alt: string; className?: string }) => <img src={src} alt={alt} className={className} /> }));

const scrollTo = vi.fn();
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
beforeEach(() => {
  media.reduced = false;
  media.desktop = false;
  vi.useFakeTimers();
  scrollTo.mockClear();
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
});

function mount() { return render(<MobileHeroCarousel><section><h1>Small steps. Big progress.</h1></section></MobileHeroCarousel>); }
function advance(ms = 5000) { act(() => { vi.advanceTimersByTime(ms); }); }
function expectCard(index: number) { expect(screen.getByRole('button', { name: new RegExp(`^Show card ${index}:`) })).toHaveAttribute('aria-current', 'true'); }

describe('mobile hero carousel', () => {
  it('keeps the original card and cycles through all three cards back to the beginning', () => {
    mount();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Small steps. Big progress.');
    expectCard(1);
    advance(); expectCard(2);
    expect(screen.getByRole('heading', { name: 'Stay Consistent' })).toBeVisible();
    advance(); expectCard(3);
    expect(screen.getByRole('heading', { name: 'Keep Moving Forward' })).toBeVisible();
    advance(); expectCard(1);
  });

  it('shows only three navigation dots and rotates from a manually selected card', () => {
    mount();
    expect(screen.getAllByRole('button')).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: /^Show card 3:/ })); expectCard(3);
    advance(); expectCard(1);
  });

  it('holds the card while a control has focus and restarts after focus leaves', () => {
    mount();
    const dot = screen.getByRole('button', { name: /^Show card 2:/ });
    fireEvent.focus(dot);
    fireEvent.click(dot);
    advance(10000); expectCard(2);
    fireEvent.blur(dot, { relatedTarget: document.body });
    advance(); expectCard(3);
  });

  it('does not rotate in a hidden tab and waits five seconds after returning', () => {
    mount();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    fireEvent(document, new Event('visibilitychange'));
    advance(15000); expectCard(1);
    hidden.mockReturnValue(false);
    fireEvent(document, new Event('visibilitychange'));
    advance(4999); expectCard(1);
    advance(1); expectCard(2);
  });

  it('disables autoplay for reduced motion while dots still navigate instantly', () => {
    media.reduced = true;
    mount();
    advance(15000); expectCard(1);
    fireEvent.click(screen.getByRole('button', { name: /^Show card 2:/ })); expectCard(2);
    advance(15000); expectCard(2);
    expect(scrollTo).toHaveBeenLastCalledWith(expect.objectContaining({ behavior: 'instant' }));
  });

  it('does not run automatic rotation in the hidden desktop mobile layout', () => {
    media.desktop = true;
    mount();
    advance(15000); expectCard(1);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('clears its pending timer when the page unmounts', () => {
    const { unmount } = mount();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps a requested destination selected through intermediate scroll events', () => {
    const { container } = mount();
    const track = container.querySelector('[aria-live]') as HTMLDivElement;
    let scrollPosition = 0;
    vi.spyOn(track, 'getBoundingClientRect').mockImplementation(() => new DOMRect(0, 0, 320, 174));
    Array.from(track.children).forEach((slide, index) => {
      vi.spyOn(slide, 'getBoundingClientRect').mockImplementation(() => new DOMRect(index * 320 - scrollPosition, 0, 320, 174));
      Object.defineProperty(slide, 'offsetLeft', { configurable: true, value: index * 320 });
    });
    const firstDot = screen.getByRole('button', { name: /^Show card 1:/ });
    fireEvent.keyDown(firstDot, { key: 'ArrowRight' }); expectCard(2);
    fireEvent.scroll(track); expectCard(2);
    fireEvent.keyDown(firstDot, { key: 'ArrowRight' }); expectCard(3);
    fireEvent.scroll(track); expectCard(3);
    scrollPosition = 640;
    fireEvent.scroll(track); expectCard(3);
  });
});
