import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import UserSettingsModal from '../UserSettingsModal';
import * as AuthContextModule from '@/context/AuthContext';
import * as UserApiModule from '@/lib/userApi';

vi.mock('@/hooks/useTheme', () => ({
  useThemeMode: () => ({
    theme: 'light',
    toggleThemeMode: vi.fn(),
  }),
}));

describe('UserSettingsModal - Notification Preferences & Daily Reminder', () => {
  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@test.com',
    progress: {},
    bookmarks: [],
  };

  const initialPreferences: UserApiModule.NotificationPreferences = {
    enabled: true,
    battleInvites: true,
    battleResults: true,
    dailyPractice: true,
    newMocks: true,
    examUpdates: true,
    announcements: true,
  };

  const initialDailyReminder: UserApiModule.DailyPracticeReminder = {
    enabled: true,
    time: '20:00',
    timezone: 'Asia/Kolkata',
    nextSendAt: '2026-09-07T14:30:00.000Z',
    lastSentAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      token: 'valid-token',
      login: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      updateProfile: vi.fn(),
      loading: false,
    });
    vi.spyOn(UserApiModule, 'getNotificationPreferences').mockResolvedValue(initialPreferences);
    vi.spyOn(UserApiModule, 'updateNotificationPreferences').mockImplementation(async (patch) => ({
      ...initialPreferences,
      ...patch,
    }));
    vi.spyOn(UserApiModule, 'getDailyPracticeReminder').mockResolvedValue(initialDailyReminder);
    vi.spyOn(UserApiModule, 'updateDailyPracticeReminder').mockImplementation(async (settings) => ({
      enabled: settings.enabled,
      time: settings.time,
      timezone: settings.timezone,
      nextSendAt: settings.enabled ? '2026-09-08T14:30:00.000Z' : null,
      lastSentAt: null,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it('renders push notifications master switch, 6 category switches, and daily practice reminder', async () => {
    render(<UserSettingsModal isOpen={true} onClose={vi.fn()} />);

    expect(screen.getByText('Preferences & Settings')).toBeDefined();
    expect(screen.getByText('Notifications')).toBeDefined();

    expect(screen.getByRole('switch', { name: /toggle push notifications/i })).toBeDefined();
    expect(screen.getByRole('switch', { name: /toggle battle invites/i })).toBeDefined();
    expect(screen.getByRole('switch', { name: /toggle battle results/i })).toBeDefined();
    expect(screen.getByRole('switch', { name: /^toggle daily practice$/i })).toBeDefined();
    expect(screen.getByRole('switch', { name: /toggle new mock tests/i })).toBeDefined();
    expect(screen.getByRole('switch', { name: /toggle exam updates/i })).toBeDefined();
    expect(screen.getByRole('switch', { name: /toggle announcements/i })).toBeDefined();
    expect(screen.getByRole('switch', { name: /toggle daily practice reminder/i })).toBeDefined();

    await waitFor(() => {
      expect(UserApiModule.getNotificationPreferences).toHaveBeenCalledTimes(1);
      expect(UserApiModule.getDailyPracticeReminder).toHaveBeenCalledTimes(1);
      expect(screen.getByLabelText(/daily reminder time/i)).toBeDefined();
    });

    expect(screen.getByText('Asia/Kolkata')).toBeDefined();
  });

  it('toggles a category preference and calls updateNotificationPreferences', async () => {
    render(<UserSettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /toggle battle invites/i })).toBeDefined();
    });

    const battleInvitesBtn = screen.getByRole('switch', { name: /toggle battle invites/i });
    fireEvent.click(battleInvitesBtn);

    await waitFor(() => {
      expect(UserApiModule.updateNotificationPreferences).toHaveBeenCalledWith({
        battleInvites: false,
      });
    });
  });

  it('toggles daily practice reminder switch and calls updateDailyPracticeReminder', async () => {
    render(<UserSettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: /toggle daily practice reminder/i })).toBeDefined();
    });

    const reminderSwitch = screen.getByRole('switch', { name: /toggle daily practice reminder/i });
    fireEvent.click(reminderSwitch);

    await waitFor(() => {
      expect(UserApiModule.updateDailyPracticeReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );
    });
  });

  it('updates reminder time when time input changes', async () => {
    render(<UserSettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/daily reminder time/i)).toBeDefined();
    });

    const timeInput = screen.getByLabelText(/daily reminder time/i);
    fireEvent.change(timeInput, { target: { value: '21:30' } });

    await waitFor(() => {
      expect(UserApiModule.updateDailyPracticeReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          time: '21:30',
        })
      );
    });
  });

  it('visually disables all category and reminder toggles when master enabled is OFF', async () => {
    vi.spyOn(UserApiModule, 'getNotificationPreferences').mockResolvedValueOnce({
      ...initialPreferences,
      enabled: false,
    });

    render(<UserSettingsModal isOpen={true} onClose={vi.fn()} />);

    await waitFor(() => {
      const masterBtn = screen.getByRole('switch', { name: /toggle push notifications/i });
      expect(masterBtn.getAttribute('aria-checked')).toBe('false');
    });

    const battleInvitesBtn = screen.getByRole('switch', { name: /toggle battle invites/i });
    const reminderSwitch = screen.getByRole('switch', { name: /toggle daily practice reminder/i });

    expect(battleInvitesBtn).toBeDisabled();
    expect(reminderSwitch).toBeDisabled();
  });
});
