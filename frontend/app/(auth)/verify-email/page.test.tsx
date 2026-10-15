import { StrictMode } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import VerifyEmailPage from './page';

const mocks = vi.hoisted(() => ({ post: vi.fn(), params: new URLSearchParams() }));
vi.mock('@/shared/api/client', () => ({ default: { post: mocks.post } }));
vi.mock('next/navigation', () => ({ useSearchParams: () => mocks.params }));

beforeEach(() => {
  mocks.post.mockReset().mockResolvedValue({ data: { emailVerified: true } });
  mocks.params = new URLSearchParams('token=secret-token');
  window.history.replaceState({ preserved: true }, '', '/verify-email?token=secret-token');
});
afterEach(cleanup);

it('removes the token before posting and verifies only once in Strict Mode', async () => {
  mocks.post.mockImplementation(async () => {
    expect(window.location.search).toBe('');
    return { data: { emailVerified: true } };
  });
  render(<StrictMode><VerifyEmailPage /></StrictMode>);
  expect(await screen.findByRole('heading', { name: 'Email verified' })).toBeInTheDocument();
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/auth/verify-email', { token: 'secret-token' });
  expect(window.location.pathname).toBe('/verify-email');
  expect(window.history.state).toEqual({ preserved: true });
  expect(screen.getByRole('link', { name: 'Continue to sign in' })).toHaveAttribute('href', '/login');
});

it('shows the pending state until verification finishes', async () => {
  mocks.post.mockReturnValue(new Promise(() => {}));
  render(<VerifyEmailPage />);
  expect(screen.getByRole('heading', { name: 'Verifying email' })).toBeInTheDocument();
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it.each(['', 'token=%20', `token=${'a'.repeat(257)}`])('rejects invalid input locally: %s', async (query) => {
  mocks.params = new URLSearchParams(query);
  render(<VerifyEmailPage />);
  expect(await screen.findByRole('heading', { name: 'Verification failed' })).toBeInTheDocument();
  expect(screen.getByText('This verification link is invalid.')).toBeInTheDocument();
  expect(window.location.search).toBe('');
  expect(mocks.post).not.toHaveBeenCalled();
});

it('shows the backend failure message and a sign-in link', async () => {
  mocks.post.mockRejectedValue({ response: { data: { error: 'Verification link is invalid or has expired' } } });
  render(<VerifyEmailPage />);
  expect(await screen.findByText('Verification link is invalid or has expired')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
});

it('shows a safe fallback for network errors', async () => {
  mocks.post.mockRejectedValue(new Error('Network failure'));
  render(<VerifyEmailPage />);
  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('This verification link is invalid or has expired.'));
});
