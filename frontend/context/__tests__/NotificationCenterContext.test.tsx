import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  NotificationCenterProvider,
  useNotificationCenter,
} from '../NotificationCenterContext';
import * as AuthContextModule from '../AuthContext';
import * as NotificationApiModule from '@/lib/api/notificationApi';

const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();

vi.mock('@/lib/socket', () => ({
  getSocket: vi.fn(() => ({
    on: mockSocketOn,
    off: mockSocketOff,
  })),
  disconnectSocket: vi.fn(),
}));

describe('NotificationCenterContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('provides zero count and no-op methods outside provider', () => {
    const { result } = renderHook(() => useNotificationCenter());
    expect(result.current.unreadCount).toBe(0);
    expect(typeof result.current.decrementUnread).toBe('function');
    expect(typeof result.current.clearUnread).toBe('function');
  });

  it('fetches unread count and listens to socket notification:new when user is authenticated', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user_1', name: 'User 1', email: 'u1@test.com', progress: {}, bookmarks: [] },
      token: 'jwt_1',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
    });

    vi.spyOn(NotificationApiModule, 'fetchUnreadNotificationCount').mockResolvedValue(3);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NotificationCenterProvider>{children}</NotificationCenterProvider>
    );

    const { result } = renderHook(() => useNotificationCenter(), { wrapper });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(3);
    });

    expect(mockSocketOn).toHaveBeenCalledWith('notification:new', expect.any(Function));
  });

  it('updates unread count when decrementUnread and clearUnread are called', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { id: 'user_1', name: 'User 1', email: 'u1@test.com', progress: {}, bookmarks: [] },
      token: 'jwt_1',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
    });

    vi.spyOn(NotificationApiModule, 'fetchUnreadNotificationCount').mockResolvedValue(2);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NotificationCenterProvider>{children}</NotificationCenterProvider>
    );

    const { result } = renderHook(() => useNotificationCenter(), { wrapper });

    await waitFor(() => {
      expect(result.current.unreadCount).toBe(2);
    });

    act(() => {
      result.current.decrementUnread();
    });
    expect(result.current.unreadCount).toBe(1);

    act(() => {
      result.current.clearUnread();
    });
    expect(result.current.unreadCount).toBe(0);
  });
});
