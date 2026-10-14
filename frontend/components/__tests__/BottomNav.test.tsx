import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, fireEvent, render as renderUI, screen } from '@testing-library/react';
import BottomNav from '../BottomNav';
import { VirtualKeyboardProvider } from '../VirtualKeyboardProvider';

const render = (ui: React.ReactNode) => renderUI(ui, { wrapper: VirtualKeyboardProvider });
const auth = vi.hoisted(() => ({ user: null as null | { name: string; avatar?: string } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));

let mockPathname = '/mock-test';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('BottomNav Component', () => {
  beforeEach(() => {
    mockPathname = '/mock-test';
    auth.user = null;
    vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: false }));
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.each(['visual', 'window', 'fallback'])('hides navigation and its clearance for a %s keyboard', (mode) => {
    vi.useFakeTimers();
    const viewport = Object.assign(new EventTarget(), { height: 800, scale: 1 });
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('visualViewport', mode === 'fallback' ? undefined : viewport);
    vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: true }));
    render(<><input aria-label="Chapter search" /><BottomNav /></>);
    expect(screen.getByRole('navigation')).toBeDefined();
    act(() => {
      screen.getByRole('textbox').focus();
      vi.runAllTimers();
      viewport.height = 470;
      if (mode === 'window') vi.stubGlobal('innerHeight', 470);
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(document.body.classList.contains('has-bottom-nav')).toBe(false);
    expect(document.documentElement.style.getPropertyValue('--app-bottom-nav-occupied-height')).toBe('0px');
    act(() => {
      viewport.height = 800;
      vi.stubGlobal('innerHeight', 800);
      if (mode === 'fallback') screen.getByRole('textbox').blur();
      viewport.dispatchEvent(new Event('resize'));
      vi.runAllTimers();
    });
    expect(screen.getByRole('navigation')).toBeDefined();
    expect(document.body.classList.contains('has-bottom-nav')).toBe(true);
  });

  it('ignores browser chrome changes, pinch zoom, and non-editable focus', () => {
    const viewport = Object.assign(new EventTarget(), { height: 800, scale: 1 });
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('visualViewport', viewport);
    vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: true }));
    render(<><input aria-label="Chapter search" /><BottomNav /></>);
    act(() => {
      viewport.height = 470;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByRole('navigation')).toBeDefined();
    act(() => {
      screen.getByRole('textbox').focus();
      viewport.height = 720;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByRole('navigation')).toBeDefined();
    act(() => {
      viewport.height = 400;
      viewport.scale = 2;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByRole('navigation')).toBeDefined();
  });

  it.each(['visual', 'window', 'fallback'])('ends search focus when the %s keyboard closes and retains the query', (mode) => {
    const viewport = Object.assign(new EventTarget(), { height: 800, scale: 1 });
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('visualViewport', mode === 'fallback' ? undefined : viewport);
    vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: true }));
    render(<><input type="search" aria-label="Chapter search" defaultValue="biology" /><BottomNav /></>);
    const search = screen.getByRole('searchbox');
    act(() => {
      search.focus();
      viewport.height = 470;
      if (mode !== 'visual') vi.stubGlobal('innerHeight', 470);
      window.dispatchEvent(new Event('resize'));
    });
    expect(document.activeElement).toBe(search);
    expect(screen.queryByRole('navigation')).toBeNull();
    act(() => {
      viewport.height = 800;
      vi.stubGlobal('innerHeight', 800);
      window.dispatchEvent(new Event('resize'));
    });
    expect(document.activeElement).not.toBe(search);
    expect(search).toHaveValue('biology');
    expect(screen.getByRole('navigation')).toBeDefined();
  });

  it('renders all core navigation links', () => {
    render(<BottomNav />);
    expect(screen.getByText('Home')).toBeDefined();
    expect(screen.getByText('Mock')).toBeDefined();
    expect(screen.getByText('Play')).toBeDefined();
    expect(screen.getByRole('link', { name: 'You' })).toHaveAttribute('href', '/profile');
    expect(screen.getByLabelText('AI Assistant')).toBeDefined();
  });

  it.each(['/mathematics', '/reasoning', '/english', '/general-awareness', '/general-awareness/ancient-history', '/subjects/iit-jam-physics/electricity-magnetism'])('hides downward and restores upward or for keyboard navigation on %s', (path) => {
    mockPathname = path;
    render(<><div data-testid="chapters" /><BottomNav /></>);
    const list = screen.getByTestId('chapters');
    Object.defineProperties(list, { scrollHeight: { value: 1000 }, clientHeight: { value: 300 } });
    const nav = screen.getByRole('navigation');
    const scroll = (top: number) => { list.scrollTop = top; fireEvent.scroll(list); };
    scroll(5);
    expect(nav).not.toHaveClass('is-hidden');
    scroll(60);
    expect(nav).toHaveClass('is-hidden');
    expect(nav).toHaveAttribute('inert');
    expect(document.body).not.toHaveClass('has-bottom-nav');
    expect(document.documentElement.style.getPropertyValue('--app-bottom-nav-occupied-height')).toBe('0px');
    scroll(57);
    expect(nav).toHaveClass('is-hidden');
    scroll(40);
    expect(nav).not.toHaveClass('is-hidden');
    expect(document.body).toHaveClass('has-bottom-nav');
    scroll(100);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(nav).not.toHaveAttribute('inert');
    expect(nav).not.toHaveClass('is-hidden');
  });

  it.each(['/', '/mock-test', '/play', '/profile', '/settings', '/mathematics/arithmetic/percentages', '/general-awareness/ancient-history/jainism-buddhism'])('keeps navigation and its clearance visible when scrolling %s', (path) => {
    mockPathname = path;
    render(<><div data-testid="home-content" /><BottomNav /></>);
    const content = screen.getByTestId('home-content');
    Object.defineProperties(content, { scrollHeight: { value: 1200 }, clientHeight: { value: 600 } });
    content.scrollTop = 200;
    fireEvent.scroll(content);
    fireEvent.scroll(document);
    const nav = screen.getByRole('navigation');
    expect(nav).not.toHaveClass('is-hidden');
    expect(nav).not.toHaveAttribute('inert');
    expect(document.body).toHaveClass('has-bottom-nav');
  });

  it('handles document scrolling and resets visibility when navigating away and back', () => {
    mockPathname = '/mathematics';
    const root = document.documentElement;
    Object.defineProperties(root, {
      scrollHeight: { configurable: true, value: 1200 },
      clientHeight: { configurable: true, value: 600 },
    });
    const { rerender } = render(<BottomNav />);
    try {
      root.scrollTop = 120;
      fireEvent.scroll(document);
      expect(screen.queryByRole('navigation')).toBeNull();
      mockPathname = '/profile';
      rerender(<BottomNav />);
      expect(screen.getByRole('navigation')).not.toHaveClass('is-hidden');
      mockPathname = '/mathematics';
      rerender(<BottomNav />);
      expect(screen.getByRole('navigation')).not.toHaveClass('is-hidden');
    } finally {
      root.scrollTop = 0;
      Reflect.deleteProperty(root, 'scrollHeight');
      Reflect.deleteProperty(root, 'clientHeight');
    }
  });

  it('does not reopen when reclaiming navigation space clamps the list at its bottom', () => {
    mockPathname = '/general-awareness/ancient-history';
    render(<><div data-testid="chapters" /><BottomNav /></>);
    const list = screen.getByTestId('chapters');
    Object.defineProperties(list, {
      scrollHeight: { value: 1000 },
      clientHeight: { configurable: true, value: 300 },
    });
    const nav = screen.getByRole('navigation');
    list.scrollTop = 700;
    fireEvent.scroll(list);
    expect(nav).toHaveClass('is-hidden');
    Object.defineProperty(list, 'clientHeight', { configurable: true, value: 380 });
    list.scrollTop = 620;
    fireEvent.scroll(list);
    expect(nav).toHaveClass('is-hidden');
    list.scrollTop = 600;
    fireEvent.scroll(list);
    expect(nav).not.toHaveClass('is-hidden');
  });

  it('uses the current profile photo and updates when the account changes', () => {
    auth.user = { name: 'Alex', avatar: '/images/alex.webp' };
    const { rerender } = render(<BottomNav />);
    const you = screen.getByRole('link', { name: 'You' });
    expect(you.querySelector('[style*="background-image"]')).toHaveStyle({ backgroundImage: 'url("/images/alex.webp")' });
    auth.user = { name: 'Blair' };
    mockPathname = '/profile';
    rerender(<BottomNav />);
    expect(you.querySelector('[style*="background-image"]')).toBeNull();
    expect(you).toHaveTextContent('B');
    expect(you).toHaveAttribute('aria-current', 'page');
  });

  it('dismisses search focus on pages without bottom navigation', () => {
    const viewport = Object.assign(new EventTarget(), { height: 800, scale: 1 });
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('visualViewport', viewport);
    vi.stubGlobal('matchMedia', () => Object.assign(new EventTarget(), { matches: true }));
    render(<input type="search" aria-label="Search users" defaultValue="Alex" />);
    const search = screen.getByRole('searchbox');
    act(() => {
      search.focus();
      viewport.height = 470;
      viewport.dispatchEvent(new Event('resize'));
    });
    act(() => {
      viewport.height = 800;
      viewport.dispatchEvent(new Event('resize'));
    });
    expect(document.activeElement).not.toBe(search);
    expect(search).toHaveValue('Alex');
  });

  it('highlights the active navigation tab', () => {
    const { container } = render(<BottomNav />);
    const activeLink = container.querySelector('a[href="/mock-test"]');
    expect(activeLink).not.toBeNull();
  });

  it.each([
    '/battle',
    '/battle/profile',
    '/battle/leaderboard',
    '/battle/missions',
    '/battle/social',
    '/battle/profile/',
    '/notifications',
    '/notifications/',
    '/play/setup/adaptive',
    '/play/setup/nightmare',
  ])('stays hidden on %s', (path) => {
    mockPathname = path;
    const { container } = render(<BottomNav />);
    expect(container.querySelector('nav')).toBeNull();
    expect(document.body.classList.contains('has-bottom-nav')).toBe(false);
    mockPathname = '/mock-test';
  });
});
