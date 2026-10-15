import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage, { LoginFallback } from './login/page';
import RegisterPage from './register/page';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  login: vi.fn(),
  replace: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({ default: { post: mocks.post } }));
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ login: mocks.login }), useAuthActions: () => ({ login: mocks.login }) }));
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
  cleanup();
});

describe('authentication forms', () => {
  it('offers OTP first, sends a code, and signs in with its leading zero preserved', async () => {
    const challengeId = 'a'.repeat(64);
    mocks.post.mockResolvedValueOnce({ data: { challengeId, retryAfter: 60 } });
    const user = userEvent.setup();
    render(<LoginPage />);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log in with OTP' })).toHaveAttribute('aria-pressed', 'true');
    await user.type(screen.getByLabelText('Email'), 'Learner@Example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/email-otp/request', { email: 'learner@example.com' }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    const input = await screen.findByLabelText('6-digit code');
    expect(input).toHaveAttribute('autocomplete', 'one-time-code');
    expect(input).toHaveFocus();
    expect(screen.getByRole('button', { name: /Resend in/ })).toBeDisabled();
    await user.type(input, '012345');
    await user.click(screen.getByRole('button', { name: 'Verify & sign in' }));
    await waitFor(() => expect(mocks.post).toHaveBeenLastCalledWith('/auth/email-otp/verify', {
      email: 'learner@example.com', challengeId, code: '012345',
    }, expect.objectContaining({ signal: expect.any(AbortSignal) })));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('test-token'));
    expect(mocks.replace).toHaveBeenCalledWith('/');
  });

  it('cancels an OTP request when switching methods and keeps the entered email', async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.click(screen.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
    const signal = mocks.post.mock.calls[0][2].signal;
    await user.click(screen.getByRole('button', { name: 'Log in with password' }));
    expect(signal.aborted).toBe(true);
    expect(screen.getByLabelText('Email')).toHaveValue('learner@example.com');
    finish({ data: { challengeId: 'a'.repeat(64) } });
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('shows an expired-code error and lets the user change the email', async () => {
    mocks.post.mockResolvedValueOnce({ data: { challengeId: 'a'.repeat(64), retryAfter: 60 } })
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
    expect(screen.queryByLabelText('6-digit code')).not.toBeInTheDocument();
  });

  it('validates login fields and submits the existing payload', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Log in with password' }));

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Email'), 'invalid');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Please enter a valid email address')).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/login', {
      email: 'learner@example.com', password: 'secret',
    }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('test-token'));
    expect(mocks.replace).toHaveBeenCalledWith('/');
  });

  it('validates registration lengths and submits the existing payload', async () => {
    const user = userEvent.setup();
    render(<RegisterPage />);

    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('Name must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Full Name'), 'A');
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument();
    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument();
    expect(mocks.post).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Full Name'), 'da');
    await user.type(screen.getByLabelText('Password'), 'er');
    mocks.post.mockResolvedValue({ data: { verificationRequired: true } });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Ada', email: 'learner@example.com', password: 'shorter',
    }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/check-email'));
    expect(sessionStorage.getItem('pendingVerificationEmail')).toBe('learner@example.com');
    expect(mocks.login).not.toHaveBeenCalled();
  });

  it('shows the verification-required login error without signing in', async () => {
    mocks.post.mockRejectedValue({ response: { status: 403, data: { error: 'Please verify your email before signing in', code: 'EMAIL_NOT_VERIFIED' } } });
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Log in with password' }));
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Please verify your email before signing in')).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('renders login fallback with full AuthCard structure, footer, and skeleton inputs', () => {
    render(<LoginFallback />);
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/register');
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
  });

  it.each([
    ['connection reset', { kind: 'network' }],
    ['proxy failure', { response: { status: 500 } }],
    ['backend unavailable', { status: 503 }],
  ])('reports service availability rather than invalid credentials after %s', async (_label, failure) => {
    mocks.post.mockRejectedValue(failure);
    const user = userEvent.setup();
    render(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Log in with password' }));
    await user.type(screen.getByLabelText('Email'), 'learner@example.com');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Unable to reach the sign-in service. Please try again shortly.')).toBeInTheDocument();
    expect(mocks.login).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
