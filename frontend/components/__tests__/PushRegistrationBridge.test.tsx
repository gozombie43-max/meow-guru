import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import PushRegistrationBridge from '../PushRegistrationBridge';
import * as AuthContextModule from '@/context/AuthContext';
import api from '@/lib/axios';

vi.mock('@/lib/axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { ok: true } }),
  },
}));

describe('PushRegistrationBridge', () => {
  const mockUserA = {
    id: 'user_A',
    name: 'User A',
    email: 'usera@example.com',
    role: 'user',
    progress: {},
    bookmarks: [],
  };

  const mockUserB = {
    id: 'user_B',
    name: 'User B',
    email: 'userb@example.com',
    role: 'user',
    progress: {},
    bookmarks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    delete window.__MEOW_FID__;
  });

  afterEach(() => {
    cleanup();
    delete window.__MEOW_FID__;
  });

  it('does nothing when user is unauthenticated or loading', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
    });

    window.__MEOW_FID__ = 'fid_device_123';

    render(<PushRegistrationBridge />);

    expect(api.post).not.toHaveBeenCalled();
  });

  it('registers device when user is authenticated and FID is available', async () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUserA,
      token: 'token-a',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
    });

    window.__MEOW_FID__ = 'fid_device_123';

    render(<PushRegistrationBridge />);

    expect(api.post).toHaveBeenCalledWith('/api/notifications/register', {
      fid: 'fid_device_123',
      platform: 'android',
    });
    expect(api.post).toHaveBeenCalledTimes(1);
  });

  it('registers via meow-fcm-registration custom event', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUserA,
      token: 'token-a',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
    });

    render(<PushRegistrationBridge />);
    expect(api.post).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(
        new CustomEvent('meow-fcm-registration', {
          detail: { fid: 'fid_device_from_event' },
        })
      );
    });

    expect(api.post).toHaveBeenCalledWith('/api/notifications/register', {
      fid: 'fid_device_from_event',
      platform: 'android',
    });
  });

  it('deduplicates registration for same userId:FID and re-registers when switching accounts with the same FID', () => {
    window.__MEOW_FID__ = 'same_phone_fid_999';

    // 1. Account A logs in
    const authSpy = vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUserA,
      token: 'token-a',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
    });

    const { rerender } = render(<PushRegistrationBridge />);

    expect(api.post).toHaveBeenCalledWith('/api/notifications/register', {
      fid: 'same_phone_fid_999',
      platform: 'android',
    });
    expect(api.post).toHaveBeenCalledTimes(1);

    // 2. Re-render with Account A (deduplication should prevent re-posting)
    rerender(<PushRegistrationBridge />);
    expect(api.post).toHaveBeenCalledTimes(1);

    // 3. User logs out
    authSpy.mockReturnValue({
      user: null,
      token: null,
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
    });
    rerender(<PushRegistrationBridge />);

    // 4. Account B logs in on the same phone
    authSpy.mockReturnValue({
      user: mockUserB,
      token: 'token-b',
      loading: false,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
    });
    rerender(<PushRegistrationBridge />);

    // Account B must register successfully even with the same FID!
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(api.post).toHaveBeenNthCalledWith(2, '/api/notifications/register', {
      fid: 'same_phone_fid_999',
      platform: 'android',
    });
  });
});
