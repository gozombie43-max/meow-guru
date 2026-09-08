import { render, screen, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import NotificationBell from '../NotificationBell';
import * as NotificationCenterModule from '@/context/NotificationCenterContext';

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: any;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders link to /notifications without badge when unreadCount is 0', () => {
    vi.spyOn(NotificationCenterModule, 'useNotificationCenter').mockReturnValue({
      unreadCount: 0,
      refreshUnreadCount: vi.fn(),
      decrementUnread: vi.fn(),
      clearUnread: vi.fn(),
    });

    render(<NotificationBell />);

    const link = screen.getByRole('link', { name: 'Notifications' });
    expect(link).toBeDefined();
    expect(link.getAttribute('href')).toBe('/notifications');
    expect(screen.queryByText(/[0-9]/)).toBeNull();
  });

  it('renders badge with count and aria-label when unreadCount > 0', () => {
    vi.spyOn(NotificationCenterModule, 'useNotificationCenter').mockReturnValue({
      unreadCount: 4,
      refreshUnreadCount: vi.fn(),
      decrementUnread: vi.fn(),
      clearUnread: vi.fn(),
    });

    render(<NotificationBell />);

    const link = screen.getByRole('link', { name: '4 unread notifications' });
    expect(link).toBeDefined();
    expect(screen.getByText('4')).toBeDefined();
  });

  it('caps badge display to 9+ when unreadCount > 9', () => {
    vi.spyOn(NotificationCenterModule, 'useNotificationCenter').mockReturnValue({
      unreadCount: 15,
      refreshUnreadCount: vi.fn(),
      decrementUnread: vi.fn(),
      clearUnread: vi.fn(),
    });

    render(<NotificationBell />);

    const link = screen.getByRole('link', { name: '15 unread notifications' });
    expect(link).toBeDefined();
    expect(screen.getByText('9+')).toBeDefined();
  });
});
