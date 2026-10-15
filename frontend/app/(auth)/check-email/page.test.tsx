import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import CheckEmailPage from './page';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('@/shared/api/client', () => ({ default: { post: mocks.post } }));

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  sessionStorage.setItem('pendingVerificationEmail', 'guru@gmail.com');
  mocks.post.mockReset().mockResolvedValue({ data: {} });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

async function mount() {
  render(<CheckEmailPage />);
  await act(async () => { await Promise.resolve(); });
}
async function advance(seconds: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(seconds * 1000); });
}

it('reads session storage, masks the address, and starts a 60-second countdown', async () => {
  await mount();
  expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
  expect(screen.getByText('gu***@gmail.com')).toBeInTheDocument();
  expect(screen.queryByText('guru@gmail.com')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Resend in 60s' })).toBeDisabled();
  await advance(59);
  expect(screen.getByRole('button', { name: 'Resend in 1s' })).toBeDisabled();
  await advance(1);
  expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeEnabled();
  expect(screen.getByRole('link', { name: /Back to sign in/ })).toHaveAttribute('href', '/login');
});

it('posts the stored email and restarts the countdown with a generic confirmation', async () => {
  await mount();
  await advance(60);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' })); });
  expect(mocks.post).toHaveBeenCalledExactlyOnceWith('/auth/resend-verification', { email: 'guru@gmail.com' });
  expect(screen.getByRole('status')).toHaveTextContent('If the account is still awaiting verification, a new link has been sent.');
  expect(screen.getByRole('button', { name: 'Resend in 60s' })).toBeDisabled();
});

it('disables repeated clicks while sending', async () => {
  mocks.post.mockReturnValue(new Promise(() => {}));
  await mount();
  await advance(60);
  fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' }));
  const button = screen.getByRole('button', { name: 'Sending…' });
  expect(button).toBeDisabled();
  fireEvent.click(button);
  expect(mocks.post).toHaveBeenCalledOnce();
});

it('shows an error and allows retry after a failed request', async () => {
  mocks.post.mockRejectedValue(new Error('Network failure'));
  await mount();
  await advance(60);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Resend verification email' })); });
  expect(screen.getByRole('status')).toHaveTextContent('Unable to request another email right now. Please try again shortly.');
  expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeEnabled();
});

it.each(['', 'invalid'])('keeps resend disabled for missing or malformed stored email: %s', async (email) => {
  sessionStorage.setItem('pendingVerificationEmail', email);
  await mount();
  await advance(60);
  expect(screen.getByText('your email address')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeDisabled();
  expect(mocks.post).not.toHaveBeenCalled();
});

it('handles unavailable browser storage without crashing', async () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage disabled'); });
  await mount();
  await advance(60);
  expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeDisabled();
});

it('catches up after a background tab is suspended and clears its interval on unmount', async () => {
  await mount();
  vi.setSystemTime(Date.now() + 65000);
  await advance(1);
  expect(screen.getByRole('button', { name: 'Resend verification email' })).toBeEnabled();
  cleanup();
  expect(vi.getTimerCount()).toBe(0);
});
