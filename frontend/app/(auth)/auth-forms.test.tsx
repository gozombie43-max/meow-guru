import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './login/page';
import RegisterPage from './register/page';

const mocks = vi.hoisted(() => ({ post: vi.fn(), login: vi.fn(), replace: vi.fn() }));

vi.mock('@/shared/api/client', () => ({ default: { post: mocks.post } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ login: mocks.login }), useAuthActions: () => ({ login: mocks.login }) }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/dynamic', () => ({ default: () => () => null }));

const challengeId = 'a'.repeat(64);
const opts = expect.objectContaining({ signal: expect.any(AbortSignal) });

beforeEach(() => {
  mocks.post.mockReset().mockResolvedValue({ data: { token: 'test-token' } });
  mocks.login.mockReset().mockResolvedValue(undefined);
  mocks.replace.mockReset();
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => cleanup());

describe('authentication forms', () => {
  it('has no Google button and signs in with a code on the same page', async () => {
    mocks.post.mockResolvedValueOnce({ data: { challengeId, retryAfter: 60 } });
    const user = userEvent.setup();
    render(<LoginPage />);
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'Learner@Example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/email-otp/request', { email: 'learner@example.com' }, opts));
    const input = await screen.findByLabelText('6-digit code');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    await user.type(input, '012345');
    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    await waitFor(() => expect(mocks.post).toHaveBeenLastCalledWith('/auth/email-otp/verify', {
      email: 'learner@example.com', challengeId, code: '012345',
    }, opts));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('test-token'));
    expect(mocks.replace).toHaveBeenCalledWith('/');
  });

  it('creates an account with name, email and an in-page code without /check-email', async () => {
    mocks.post.mockResolvedValueOnce({ data: { challengeId, retryAfter: 60 } });
    const user = userEvent.setup();
    render(<RegisterPage />);
    expect(screen.queryByText(/google/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Enter your name');
    expect(mocks.post).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Full name'), 'Ada Lovelace');
    await user.type(screen.getByLabelText('Email'), 'ada@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('6-digit code'), '654321');
    await user.click(screen.getByRole('button', { name: 'Verify & create account' }));
    await waitFor(() => expect(mocks.post).toHaveBeenLastCalledWith('/auth/email-otp/verify', {
      email: 'ada@example.com', challengeId, code: '654321', name: 'Ada Lovelace',
    }, opts));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('test-token'));
    expect(mocks.replace).toHaveBeenCalledWith('/');
    expect(mocks.replace).not.toHaveBeenCalledWith('/check-email');
  });

  it('shows an expired-code error and lets the user change the email', async () => {
    mocks.post.mockResolvedValueOnce({ data: { challengeId, retryAfter: 60 } })
      .mockRejectedValueOnce({ response: { status: 401, data: { error: 'Code is invalid or expired. Request a new code.' } } });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await user.type(await screen.findByLabelText('6-digit code'), '123456');
    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Code is invalid or expired. Request a new code.');
    expect(mocks.login).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Change email' }));
    expect(screen.getByLabelText('Email')).toHaveValue('learner@example.com');
  });

  it('keeps password sign-in as a secondary option', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Log in with password' }));
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/login', { email: 'learner@example.com', password: 'secret' }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('test-token'));
  });

  it.each([
    ['connection reset', { kind: 'network' }],
    ['backend unavailable', { status: 503 }],
  ])('reports service availability after %s', async (_label, failure) => {
    mocks.post.mockRejectedValue(failure);
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Log in with password' }));
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Unable to reach the sign-in service. Please try again shortly.')).toBeInTheDocument();
  });
});