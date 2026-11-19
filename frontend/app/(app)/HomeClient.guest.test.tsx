import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import HomeClient from './HomeClient';

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  });
});

const auth = vi.hoisted(() => ({ user: null as null | { name: string }, loading: true }));

vi.mock('@/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('@/context/ExamModeContext', () => ({ useExamMode: () => ({ isJam: false }) }));
vi.mock('@/hooks/useTheme', () => ({
  useThemeMode: () => ({ theme: 'light', setThemeMode: vi.fn(), toggleThemeMode: vi.fn() }),
}));
vi.mock('@/components/ui/Dialog', () => ({ useModalSurface: () => undefined }));
vi.mock('@/components/ExamModeSwitch', () => ({ default: () => null }));
vi.mock('@/components/ExamHomeContent', () => ({ default: () => null }));
vi.mock('@/components/NotificationBell', () => ({ default: () => null }));
vi.mock('@/components/UserProfileMenu', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

const renderHome = (mayHaveSession: boolean) =>
  render(<HomeClient mayHaveSession={mayHaveSession} desktopContent={<p>home-desktop</p>} mobileContent={<p>home-mobile</p>} />);

afterEach(cleanup);

describe('home vs. introduction for new visitors', () => {
  it('shows the introduction immediately for a visitor without a session cookie, even while auth loads', () => {
    Object.assign(auth, { user: null, loading: true });
    renderHome(false);
    expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument();
    expect(screen.queryByText('home-desktop')).not.toBeInTheDocument();
  });

  it('keeps the home page while a possible session is being restored', () => {
    Object.assign(auth, { user: null, loading: true });
    renderHome(true);
    expect(screen.getByText('home-desktop')).toBeInTheDocument();
  });

  it('falls back to the introduction when the session cookie turns out to be invalid', () => {
    Object.assign(auth, { user: null, loading: false });
    renderHome(true);
    expect(screen.getByRole('link', { name: /get started/i })).toBeInTheDocument();
  });

  it('shows the home page for a signed-in user', () => {
    Object.assign(auth, { user: { name: 'New learner' }, loading: false });
    renderHome(false);
    expect(screen.getByText('home-desktop')).toBeInTheDocument();
  });
});
