import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';

const mockDisconnectSocket = vi.fn();
vi.mock('@/lib/socket', () => ({
  disconnectSocket: () => mockDisconnectSocket(),
}));

vi.mock('@/lib/axios', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: { user: { id: 'u1', name: 'Test', email: 'test@example.com' } } }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
  AUTH_TOKEN_CHANGED_EVENT: 'auth:token-changed',
  clearLegacyAuthStorage: vi.fn(),
  getAccessToken: vi.fn().mockReturnValue(null),
  requestTokenRefresh: vi.fn().mockResolvedValue(null),
  updateAccessToken: vi.fn(),
}));

describe('AuthContext Provider', () => {
  it('returns default context value outside AuthProvider', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current).toBeDefined();
  });

  it('provides unauthenticated state by default', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
  });

  it('logs out and clears user state', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(mockDisconnectSocket).toHaveBeenCalled();
  });

  it('unregisters push device if window.__MEOW_FID__ is present on logout', async () => {
    window.__MEOW_FID__ = 'fcm_installed_token_123';
    const api = (await import('@/lib/axios')).default;

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(api.post).toHaveBeenCalledWith('/api/notifications/unregister', {
      fid: 'fcm_installed_token_123',
    });
    expect(api.post).toHaveBeenCalledWith('/auth/logout');
    delete window.__MEOW_FID__;
  });
});
