import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import BottomNav from '../BottomNav';

let mockPathname = '/mock-test';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('BottomNav Component', () => {
  beforeEach(() => {
    mockPathname = '/mock-test';
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
    expect(screen.getByText('Profile')).toBeDefined();
    expect(screen.getByLabelText('AI Assistant')).toBeDefined();
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
