// @vitest-environment jsdom
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AuthGate, { isPublicPath } from './AuthGate';

const authState = vi.hoisted(() => ({
  user: null as { id: string; name: string } | null,
  loading: true,
}));

const navState = vi.hoisted(() => ({
  pathname: '/battle/rewards',
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
  useRouter: () => ({
    replace: navState.replace,
    push: navState.push,
  }),
}));

vi.mock('@/components/ui/Dialog', () => ({
  useNativeDialog: () => undefined,
}));

vi.mock('@/components/auth/AuthFlow', () => ({
  default: () => <div data-testid="auth-flow">AuthFlow Modal</div>,
}));

describe('AuthGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = null;
    authState.loading = true;
    navState.pathname = '/battle/rewards';
  });

  afterEach(() => {
    cleanup();
  });

  it('recognizes public paths and normalizes trailing slashes', () => {
    expect(isPublicPath('/')).toBe(true);
    expect(isPublicPath('/login')).toBe(true);
    expect(isPublicPath('/register/')).toBe(true);
    expect(isPublicPath('/access-code')).toBe(true);
    expect(isPublicPath('/battle/rewards')).toBe(false);
    expect(isPublicPath(null)).toBe(false);
  });

  it('mounts protected route shells during initial auth loading without flashing the sign-in modal', () => {
    const { rerender } = render(
      <AuthGate>
        <div data-testid="protected-child">Protected Content</div>
      </AuthGate>
    );

    expect(screen.getByTestId('protected-child')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-flow')).not.toBeInTheDocument();

    // Once auth resolves with a signed-in user, content remains mounted without modal interruption
    authState.loading = false;
    authState.user = { id: 'u1', name: 'Student' };
    rerender(
      <AuthGate>
        <div data-testid="protected-child">Protected Content</div>
      </AuthGate>
    );

    expect(screen.getByTestId('protected-child')).toBeInTheDocument();
    expect(screen.queryByTestId('auth-flow')).not.toBeInTheDocument();
  });

  it('mounts public routes immediately even while auth is loading', () => {
    navState.pathname = '/';
    authState.loading = true;
    authState.user = null;

    render(
      <AuthGate>
        <div data-testid="public-home">Public Home</div>
      </AuthGate>
    );

    expect(screen.getByTestId('public-home')).toBeInTheDocument();
  });

  it('blocks protected routes and opens the sign-in modal when auth finishes loading with no user', () => {
    navState.pathname = '/notifications';
    authState.loading = false;
    authState.user = null;

    render(
      <AuthGate>
        <div data-testid="protected-child">Protected Content</div>
      </AuthGate>
    );

    expect(screen.queryByTestId('protected-child')).not.toBeInTheDocument();
    expect(screen.getByTestId('auth-flow')).toBeInTheDocument();
  });
});
