import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import UserProfileMenu from '../UserProfileMenu';
import * as AuthContextModule from '@/context/AuthContext';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

describe('UserProfileMenu Component', () => {
  const mockLogout = vi.fn().mockResolvedValue(undefined);
  const mockUpdateProfile = vi.fn().mockResolvedValue({ id: 'user-123', name: 'John Updated', email: 'john@test.com' });

  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@test.com',
    avatar: 'https://example.com/avatar.jpg',
    progress: {},
    bookmarks: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, 'useAuth').mockReturnValue({
      user: mockUser,
      token: 'valid-token',
      login: vi.fn(),
      logout: mockLogout,
      refreshUser: vi.fn(),
      updateProfile: mockUpdateProfile,
      loading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the avatar trigger button with user initial or avatar', () => {
    render(<UserProfileMenu size={34} />);
    const trigger = screen.getByRole('button', { name: /user profile menu/i });
    expect(trigger).toBeDefined();
  });

  it('opens mini popup modal upon clicking avatar and shows user info and actions', () => {
    render(<UserProfileMenu size={34} />);
    const trigger = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(trigger);

    expect(screen.getByText('John Doe')).toBeDefined();
    expect(screen.getByText('john@test.com')).toBeDefined();
    expect(screen.getByText('Edit Profile')).toBeDefined();
    expect(screen.getByText('Settings')).toBeDefined();
    expect(screen.getByText('Log Out')).toBeDefined();
  });

  it('calls logout when Log Out button is clicked', async () => {
    render(<UserProfileMenu size={34} />);
    const trigger = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(trigger);

    const logoutBtn = screen.getByRole('menuitem', { name: /log out/i });
    fireEvent.click(logoutBtn);

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });

  it('opens Edit Profile modal when Edit Profile is clicked', () => {
    render(<UserProfileMenu size={34} />);
    const trigger = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(trigger);

    const editProfileBtn = screen.getByRole('menuitem', { name: /edit profile/i });
    fireEvent.click(editProfileBtn);

    expect(screen.getByRole('dialog', { name: /edit profile/i })).toBeDefined();
    expect(screen.getByLabelText(/full name/i)).toBeDefined();
  });

  it('opens Settings modal when Settings is clicked', () => {
    render(<UserProfileMenu size={34} />);
    const trigger = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(trigger);

    const settingsBtn = screen.getByRole('menuitem', { name: /settings/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByRole('dialog', { name: /preferences & settings/i })).toBeDefined();
    expect(screen.getByText(/dark theme/i)).toBeDefined();
    expect(screen.getByText(/sound effects/i)).toBeDefined();
  });

  it('closes popover on Escape key', () => {
    render(<UserProfileMenu size={34} />);
    const trigger = screen.getByRole('button', { name: /user profile menu/i });
    fireEvent.click(trigger);

    expect(screen.getByText('John Doe')).toBeDefined();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('john@test.com')).toBeNull();
  });
});
