import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './page';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  login: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({ default: { post: mocks.post } }));
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ login: mocks.login }),
  useAuthActions: () => ({ login: mocks.login }),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

beforeEach(() => {
  mocks.post.mockReset().mockResolvedValue({ data: { token: 'test-token' } });
  mocks.login.mockReset().mockResolvedValue(undefined);
  mocks.replace.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  cleanup();
});

describe('VULN-05 Regression: Post-Login Open Redirect Prevention', () => {
  it.each([
    ['external https URL in redirect', '?redirect=https://evil.example/phish', '/'],
    ['external http URL in next', '?next=http://evil.example/phish', '/'],
    ['protocol-relative URL in redirect', '?redirect=//evil.example/phish', '/'],
    ['backslash-prefixed URL in next', '?next=/\\evil.example', '/'],
    ['javascript URI in redirect', '?redirect=javascript:alert(1)', '/'],
    ['legitimate internal deep link in redirect', '?redirect=%2Fplay%2Fmathematics%3Fexam%3D1', '/play/mathematics?exam=1'],
    ['legitimate internal deep link in next', '?next=%2Fdashboard', '/dashboard'],
  ])('EXPLOIT REPRODUCTION: sanitizes post-login redirect target (%s)', async (_label, search, expectedTarget) => {
    window.history.replaceState({}, '', `/login${search}`);
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Log in with password' }));
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('test-token'));
    expect(mocks.replace).toHaveBeenCalledWith(expectedTarget);
  });
});
