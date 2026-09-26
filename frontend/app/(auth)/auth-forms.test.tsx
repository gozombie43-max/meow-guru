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
});

afterEach(() => {
  cleanup();
});

describe('authentication forms', () => {
  it('validates login fields and submits the existing payload', async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

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
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(mocks.post).toHaveBeenCalledWith('/auth/register', {
      name: 'Ada', email: 'learner@example.com', password: 'shorter',
    }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('test-token'));
    expect(mocks.replace).toHaveBeenCalledWith('/');
  });

  it('renders login fallback with full AuthCard structure, footer, and skeleton inputs', () => {
    render(<LoginFallback />);
    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/register');
    expect(screen.getByLabelText('Email')).toBeDisabled();
    expect(screen.getByLabelText('Password')).toBeDisabled();
  });
});
