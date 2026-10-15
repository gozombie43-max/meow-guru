import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ResetPasswordPage from './page';

const mocks = vi.hoisted(() => ({ post: vi.fn(), replace: vi.fn(), params: new URLSearchParams(), router: {} }));
vi.mock('@/shared/api/client', () => ({ default: { post: mocks.post } }));
vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.params, useRouter: () => mocks.router }));
beforeEach(() => {
  mocks.post.mockReset().mockResolvedValue({ data: {} });
  mocks.replace.mockReset();
  mocks.router = { replace: mocks.replace };
  mocks.params = new URLSearchParams('token=secret-reset-token');
  window.history.replaceState({ preserved: true }, '', '/reset-password?token=secret-reset-token');
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

async function mount() {
  const view = render(<StrictMode><ResetPasswordPage /></StrictMode>);
  await act(async () => { await Promise.resolve(); });
  return view;
}
function fill(password = 'NewPassword123!', confirm = password) {
  fireEvent.change(screen.getByLabelText('New password'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm password'), { target: { value: confirm } });
}
function submit() { fireEvent.submit(screen.getByLabelText('New password').closest('form')!); }

it('captures the token once, removes it from the URL, and preserves it across query updates and Strict Mode', async () => {
  const { rerender } = await mount();
  expect(window.location.pathname).toBe('/reset-password');
  expect(window.location.search).toBe('');
  expect(window.history.state).toEqual({ preserved: true });
  expect(mocks.post).not.toHaveBeenCalled();
  mocks.params = new URLSearchParams();
  rerender(<StrictMode><ResetPasswordPage /></StrictMode>);
  fill();
  await act(async () => submit());
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/auth/reset-password', { token: 'secret-reset-token', password: 'NewPassword123!' }, { signal: expect.any(AbortSignal) });
  expect(screen.getByRole('heading', { name: 'Password changed' })).toBeInTheDocument();
});

it.each(['', 'token=%20', `token=${'a'.repeat(257)}`])('disables invalid links without sending: %s', async query => {
  mocks.params = new URLSearchParams(query);
  await mount();
  expect(screen.getByRole('alert')).toHaveTextContent('This password reset link is invalid.');
  expect(screen.getByRole('button', { name: 'Reset password' })).toBeDisabled();
  expect(window.location.search).toBe('');
  expect(mocks.post).not.toHaveBeenCalled();
});

it.each([
  ['short', 'short', 'Password must be at least 6 characters.'],
  ['password', 'different', 'Passwords do not match.'],
  ['a'.repeat(129), 'a'.repeat(129), 'Password is too long.'],
  ['a'.repeat(73), 'a'.repeat(73), 'Password is too long.'],
  ['😀'.repeat(19), '😀'.repeat(19), 'Password is too long.'],
])('validates passwords before posting', async (password, confirm, error) => {
  await mount();
  fill(password, confirm);
  submit();
  expect(screen.getByRole('alert')).toHaveTextContent(error);
  expect(mocks.post).not.toHaveBeenCalled();
});

it('prevents duplicate submissions while pending', async () => {
  mocks.post.mockReturnValue(new Promise(() => {}));
  await mount();
  fill();
  submit();
  submit();
  expect(screen.getByRole('button', { name: 'Updating…' })).toBeDisabled();
  expect(mocks.post).toHaveBeenCalledOnce();
});

it.each([
  [{ response: { data: { error: 'Password reset link is invalid or has expired' } } }, 'Password reset link is invalid or has expired'],
  [new Error('Network unavailable'), 'Unable to reset your password.'],
])('shows server or network errors and permits retry', async (error, message) => {
  mocks.post.mockRejectedValue(error);
  await mount();
  fill();
  await act(async () => submit());
  expect(screen.getByRole('alert')).toHaveTextContent(message);
  expect(screen.getByRole('button', { name: 'Reset password' })).toBeEnabled();
});

it('shows success, removes the form, and redirects to sign in after two seconds', async () => {
  await mount();
  vi.useFakeTimers();
  fill();
  await act(async () => submit());
  expect(screen.getByRole('status')).toHaveTextContent('Sign in again using your new password.');
  expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  expect(mocks.replace).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(2000));
  expect(mocks.replace).toHaveBeenCalledExactlyOnceWith('/login');
});

it('cleans up the redirect timer on unmount', async () => {
  const { unmount } = await mount();
  vi.useFakeTimers();
  fill();
  await act(async () => submit());
  unmount();
  await act(async () => vi.advanceTimersByTime(3000));
  expect(mocks.replace).not.toHaveBeenCalled();
});

it('aborts a pending reset on unmount', async () => {
  mocks.post.mockReturnValue(new Promise(() => {}));
  const { unmount } = await mount();
  fill();
  submit();
  const signal = mocks.post.mock.calls[0][2].signal as AbortSignal;
  unmount();
  expect(signal.aborted).toBe(true);
});
