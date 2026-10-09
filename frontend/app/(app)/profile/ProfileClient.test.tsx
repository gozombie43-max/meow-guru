import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Auth from '@/context/AuthContext';
import ProfileClient from './ProfileClient';

const { router } = vi.hoisted(() => ({ router: { replace: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

vi.mock('@/context/NotificationCenterContext', () => ({ useNotificationCenter: () => ({ unreadCount: 3 }) }));
vi.mock('@/lib/userApi', () => ({
  getNotificationPreferences: vi.fn().mockResolvedValue({ enabled: true }),
  getDailyPracticeReminder: vi.fn().mockResolvedValue({ enabled: false, time: '20:00', timezone: 'Asia/Kolkata' }),
  getStudyGoal: vi.fn().mockResolvedValue({ dailyGoalMinutes: 30 }),
}));

const user = { id: 'u1', name: 'Test Student', email: 'student@example.com', progress: { physics: { attempted: 10, correct: 8 } }, bookmarks: ['q1', 'q2'], role: 'user' };
const logout = vi.fn();
const updateProfile = vi.fn();
function mockAuth(overrides: Partial<ReturnType<typeof Auth.useAuth>> = {}) {
  vi.spyOn(Auth, 'useAuth').mockReturnValue({ user, loading: false, token: 'test', login: vi.fn(), logout, updateProfile, refreshUser: vi.fn(), ...overrides });
}

describe('Profile page', () => {
  beforeEach(() => { vi.clearAllMocks(); mockAuth(); });
  it('shows account data, calculated study totals, and real destinations', () => {
    render(<ProfileClient />);
    expect(screen.getByText(user.name)).toBeInTheDocument();
    expect(screen.getByText(user.email)).toBeInTheDocument();
    const stats = screen.getByLabelText('Study statistics');
    for (const value of ['10', '80%', '2']) expect(within(stats).getByText(value)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Notifications/ })).toHaveAttribute('href', '/notifications');
    expect(screen.getByRole('link', { name: 'My dashboard' })).toHaveAttribute('href', '/dashboard');
    expect(screen.queryByRole('link', { name: 'My notes' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Battle profile/ })).toHaveAttribute('href', '/battle/profile');
    expect(screen.queryByRole('link', { name: 'Admin Panel' })).not.toBeInTheDocument();
  });
  it.each(['admin', 'superadmin'])('keeps the admin destination for %s', role => {
    mockAuth({ user: { ...user, role } });
    render(<ProfileClient />);
    expect(screen.getByRole('link', { name: 'Admin Panel' })).toHaveAttribute('href', '/admincontrol');
  });
  it('opens the existing edit form and saves through AuthContext', async () => {
    updateProfile.mockResolvedValue({ ...user, name: 'Updated Student' });
    render(<ProfileClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit profile' }));
    const input = await screen.findByLabelText(/full name/i);
    await waitFor(() => expect(input).toHaveValue(user.name));
    fireEvent.change(input, { target: { value: 'Updated Student' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    await waitFor(() => expect(updateProfile).toHaveBeenCalledWith({ name: 'Updated Student', avatar: null }));
    expect(await screen.findByText('Profile updated successfully.')).toBeInTheDocument();
  });
  it('opens the existing preferences dialog', async () => {
    render(<ProfileClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Preferences & reminders' }));
    expect(await screen.findByRole('dialog', { name: /preferences & settings/i })).toBeInTheDocument();
  });
  it('logs out through the existing auth flow', async () => {
    render(<ProfileClient />);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
  });
  it('waits for authentication then redirects guests directly to login', () => {
    mockAuth({ user: null, loading: true });
    const { rerender } = render(<ProfileClient />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your profile');
    expect(router.replace).not.toHaveBeenCalled();
    mockAuth({ user: null });
    rerender(<ProfileClient />);
    expect(router.replace).toHaveBeenCalledWith('/login');
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument();
    expect(screen.queryByText('Your study journey starts here')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Study statistics')).not.toBeInTheDocument();
  });
});
