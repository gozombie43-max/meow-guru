import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import ScheduledNotificationsPanel from '../ScheduledNotificationsPanel';
import * as AdminApiModule from '@/lib/api/adminApi';

describe('ScheduledNotificationsPanel Component', () => {
  const mockPendingItem: AdminApiModule.ScheduledNotificationItem = {
    _id: 'sched-1',
    title: 'Daily Practice 🔥',
    body: 'Your SSC practice set is ready.',
    route: '/practice',
    sendAt: '2026-09-08T08:00:00.000Z',
    createdAt: '2026-09-07T12:00:00.000Z',
    status: 'pending',
  };

  const mockFailedItem: AdminApiModule.ScheduledNotificationItem = {
    _id: 'sched-2',
    title: 'Exam Update',
    body: 'Important exam alert.',
    route: '/exam',
    sendAt: '2026-09-07T08:00:00.000Z',
    createdAt: '2026-09-07T07:00:00.000Z',
    status: 'failed',
    error: 'Firebase request timeout',
    attempts: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AdminApiModule, 'fetchScheduledNotifications').mockImplementation(async (status) => {
      if (status === 'failed') {
        return {
          items: [mockFailedItem],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          counts: {
            pending: 1,
            sent: 0,
            failed: 1,
            cancelled: 0,
          },
        };
      }
      return {
        items: [mockPendingItem],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        counts: {
          pending: 1,
          sent: 0,
          failed: 1,
          cancelled: 0,
        },
      };
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders tabs with counts and upcoming items by default', async () => {
    render(<ScheduledNotificationsPanel />);

    expect(screen.getByText('Scheduled Notifications')).toBeDefined();
    expect(screen.getByRole('tab', { name: /Upcoming/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Sent/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Failed/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /Cancelled/i })).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('Daily Practice 🔥')).toBeDefined();
      expect(screen.getByText('Your SSC practice set is ready.')).toBeDefined();
      expect(screen.getByText('Route: /practice')).toBeDefined();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeDefined();
    });
  });

  it('cancels a pending notification when Cancel is clicked', async () => {
    const cancelSpy = vi
      .spyOn(AdminApiModule, 'cancelScheduledNotification')
      .mockResolvedValueOnce({ ok: true });

    render(<ScheduledNotificationsPanel />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeDefined();
    });

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith('sched-1');
    });
  });

  it('switches to Failed tab and displays failed items with error and attempts', async () => {
    render(<ScheduledNotificationsPanel />);

    const failedTab = screen.getByRole('tab', { name: /Failed/i });
    fireEvent.click(failedTab);

    await waitFor(() => {
      expect(screen.getByText('Exam Update')).toBeDefined();
      expect(screen.getByText(/Failed:\s*Firebase request timeout/i)).toBeDefined();
      expect(screen.getByText(/Attempts:\s*1/i)).toBeDefined();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
    });
  });

  it('opens confirmation modal when Retry is clicked and triggers retryScheduledNotification on confirm', async () => {
    const retrySpy = vi
      .spyOn(AdminApiModule, 'retryScheduledNotification')
      .mockResolvedValueOnce({ ok: true, id: 'sched-retry-3', sendAt: '...' });

    render(<ScheduledNotificationsPanel />);

    const failedTab = screen.getByRole('tab', { name: /Failed/i });
    fireEvent.click(failedTab);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Retry/i })).toBeDefined();
    });

    const retryBtn = screen.getByRole('button', { name: /Retry/i });
    fireEvent.click(retryBtn);

    // Modal should be visible with warning notice
    expect(screen.getByText('Retry failed notification?')).toBeDefined();
    expect(
      screen.getByText(
        /This notification previously failed or was interrupted\. Retrying may occasionally result in a duplicate push\. Retry anyway\?/i
      )
    ).toBeDefined();

    const confirmRetryBtn = screen.getByRole('button', { name: /Retry Anyway/i });
    fireEvent.click(confirmRetryBtn);

    await waitFor(() => {
      expect(retrySpy).toHaveBeenCalledWith('sched-2');
    });
  });
});
