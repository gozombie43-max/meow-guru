import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import AdminNotificationsPage from '../page';
import * as AuthContextModule from '@/context/AuthContext';
import * as AdminApiModule from '@/lib/api/adminApi';

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

describe('AdminNotificationsPage', () => {
  const mockAdminUser = {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@quizguru.com',
    role: 'admin',
    progress: {},
    bookmarks: [],
  };

  const sampleHistoryItem: AdminApiModule.NotificationHistoryItem = {
    _id: 'hist-1',
    type: 'broadcast',
    title: 'New Mock Test 🔥',
    body: 'SSC CGL Mock Test 12 is now available.',
    route: '/mock-test',
    totalDevices: 44,
    successCount: 42,
    failureCount: 2,
    invalidDeviceCount: 1,
    sentByUserId: 'admin-1',
    sentByEmail: 'admin@example.com',
    createdAt: '2026-09-07T10:42:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockAdminUser,
      token: 'admin-token',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
      loading: false,
    });

    vi.spyOn(AdminApiModule, 'fetchNotificationHistory').mockResolvedValue({
      items: [sampleHistoryItem],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    vi.spyOn(AdminApiModule, 'fetchScheduledNotifications').mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
      counts: {
        pending: 0,
        sent: 0,
        failed: 0,
        cancelled: 0,
      },
    });

    vi.spyOn(AdminApiModule, 'fetchNotificationAnalytics').mockResolvedValue({
      days: 30,
      notifications: 5,
      targetDevices: 50,
      acceptedCount: 48,
      failureCount: 2,
      opened: 24,
      pushOpened: 16,
      inAppOpened: 12,
      actionClicked: 18,
      openRate: 50.0,
      actionRate: 37.5,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects to /login if unauthenticated', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: null,
      token: null,
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
      loading: false,
    });

    render(<AdminNotificationsPage />);
    expect(mockPush).toHaveBeenCalledWith('/login');
  });

  it('redirects to / if user role is not admin or superadmin', () => {
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: { ...mockAdminUser, role: 'user' },
      token: 'user-token',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
      loading: false,
    });

    render(<AdminNotificationsPage />);
    expect(mockPush).toHaveBeenCalledWith('/');
  });

  it('renders notification form with inputs and live preview', () => {
    render(<AdminNotificationsPage />);

    expect(screen.getByText('Broadcast Notifications')).toBeDefined();
    expect(screen.getByLabelText(/Title/i)).toBeDefined();
    expect(screen.getByLabelText(/Message Body/i)).toBeDefined();
    expect(screen.getByLabelText(/Target App Route/i)).toBeDefined();
    expect(screen.getByText('Live Android Preview')).toBeDefined();
  });

  it('updates live preview when title, body, and route change', () => {
    render(<AdminNotificationsPage />);

    const titleInput = screen.getByLabelText(/Title/i);
    const bodyInput = screen.getByLabelText(/Message Body/i);
    const routeInput = screen.getByLabelText(/Target App Route/i);

    fireEvent.change(titleInput, { target: { value: 'New Test Alert 🚨' } });
    fireEvent.change(bodyInput, { target: { value: 'Tier 2 Mock is active!' } });
    fireEvent.change(routeInput, { target: { value: '/tier-2' } });

    expect(screen.getAllByText('New Test Alert 🚨').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Tier 2 Mock is active!').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Opens:\s*\/tier-2/)).toBeDefined();
  });

  it('allows clicking quick route preset chip to set route', () => {
    render(<AdminNotificationsPage />);

    const mockTestsChip = screen.getByRole('button', { name: /Mock Tests/i });
    fireEvent.click(mockTestsChip);

    const routeInput = screen.getByLabelText(/Target App Route/i) as HTMLInputElement;
    expect(routeInput.value).toBe('/mock-test');
  });

  it('opens confirmation modal before broadcasting and sends notification', async () => {
    const sendSpy = vi
      .spyOn(AdminApiModule, 'sendBroadcastNotification')
      .mockResolvedValueOnce({
        ok: true,
        totalDevices: 42,
        successCount: 40,
        failureCount: 2,
        invalidDeviceCount: 1,
      });

    render(<AdminNotificationsPage />);

    const titleInput = screen.getByLabelText(/Title/i);
    const bodyInput = screen.getByLabelText(/Message Body/i);

    fireEvent.change(titleInput, { target: { value: 'Flash Quiz ⚡' } });
    fireEvent.change(bodyInput, { target: { value: 'Daily 10 questions ready now!' } });

    const submitBtn = screen.getByRole('button', {
      name: /Review & Broadcast to All Users/i,
    });
    fireEvent.click(submitBtn);

    expect(
      screen.getByText('Send notification to all registered Android users?')
    ).toBeDefined();
    expect(screen.getByText('Recipients:')).toBeDefined();
    expect(screen.getByText('All registered devices')).toBeDefined();

    const confirmBtn = screen.getByRole('button', { name: /^Send$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith({
        title: 'Flash Quiz ⚡',
        body: 'Daily 10 questions ready now!',
        route: '/',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Sent successfully')).toBeDefined();
      expect(screen.getAllByText('42').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('40')).toBeDefined();
      expect(screen.getByText('Registered devices')).toBeDefined();
      expect(screen.getAllByText('FCM Accepted').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Failed').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Invalid devices')).toBeDefined();
    });
  });

  it('handles broadcast API error gracefully', async () => {
    vi.spyOn(AdminApiModule, 'sendBroadcastNotification').mockRejectedValueOnce({
      response: { data: { error: 'Multicast failed on FCM' } },
    });

    render(<AdminNotificationsPage />);

    const titleInput = screen.getByLabelText(/Title/i);
    const bodyInput = screen.getByLabelText(/Message Body/i);

    fireEvent.change(titleInput, { target: { value: 'Test Title' } });
    fireEvent.change(bodyInput, { target: { value: 'Test Body' } });

    const submitBtn = screen.getByRole('button', {
      name: /Review & Broadcast to All Users/i,
    });
    fireEvent.click(submitBtn);

    const confirmBtn = screen.getByRole('button', { name: /^Send$/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeDefined();
      expect(screen.getByText('Multicast failed on FCM')).toBeDefined();
    });
  });

  it('renders recent notifications history with title, body, route, counts, and sender', async () => {
    render(<AdminNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('Recent Notifications')).toBeDefined();
      expect(screen.getAllByText('New Mock Test 🔥').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('SSC CGL Mock Test 12 is now available.').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('42', { selector: 'strong' })).toBeDefined();
      expect(screen.getByText(/admin@example\.com/)).toBeDefined();
      expect(screen.getAllByText('/mock-test').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('renders empty state when no history records exist', async () => {
    vi.spyOn(AdminApiModule, 'fetchNotificationHistory').mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    render(<AdminNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('No notifications sent yet')).toBeDefined();
    });
  });

  it('refreshes history when refresh button is clicked', async () => {
    const fetchSpy = vi.spyOn(AdminApiModule, 'fetchNotificationHistory');
    render(<AdminNotificationsPage />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    const refreshBtn = screen.getByRole('button', { name: /Refresh history/i });
    expect(refreshBtn).not.toBeDisabled();
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });

  it('renders automatic new-mock history items with badge and system attribution', async () => {
    const mockItem: AdminApiModule.NotificationHistoryItem = {
      _id: 'hist-mock-1',
      type: 'new-mock',
      title: 'New Mock Test 🎯',
      body: 'SSC CGL Tier 1 Mock 15 is now available.',
      route: '/mock-test/ssc-cgl/mock-15',
      totalDevices: 50,
      successCount: 48,
      failureCount: 2,
      invalidDeviceCount: 0,
      createdAt: '2026-09-07T12:00:00.000Z',
    };

    vi.spyOn(AdminApiModule, 'fetchNotificationHistory').mockResolvedValueOnce({
      items: [mockItem],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    render(<AdminNotificationsPage />);

    await waitFor(() => {
      expect(screen.getByText('🎯 Auto — New Mock')).toBeDefined();
      expect(screen.getByText('System (Auto)')).toBeDefined();
      expect(screen.getByText('/mock-test/ssc-cgl/mock-15')).toBeDefined();
    });
  });

  it('renders notification performance with unique and source-specific opens', async () => {
    render(<AdminNotificationsPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Notification Performance · Last 30 days')
      ).toBeDefined();
      expect(screen.getByText('FCM Accepted')).toBeDefined();
      expect(screen.getByText('Unique Opens')).toBeDefined();
      expect(screen.getByText('Android Push Opens')).toBeDefined();
      expect(screen.getByText('Notification Center Opens')).toBeDefined();
      expect(screen.getByText('50%')).toBeDefined();
      expect(screen.getByText('Action Clicks')).toBeDefined();
      expect(screen.getByText('37.5%')).toBeDefined();
      expect(screen.getByText('FCM Failed')).toBeDefined();
    });
  });
});
