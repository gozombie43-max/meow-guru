import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import * as Auth from '@/context/AuthContext';
import UserProfileMenu from '../UserProfileMenu';

describe('Header profile link', () => {
  it('takes signed-in users to the central profile page', () => {
    vi.spyOn(Auth, 'useAuth').mockReturnValue({ user: { name: 'John Doe' } } as ReturnType<typeof Auth.useAuth>);
    render(<UserProfileMenu />);
    expect(screen.getByRole('link', { name: 'Your profile' })).toHaveAttribute('href', '/profile');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });
  it('keeps login available for guests', () => {
    vi.spyOn(Auth, 'useAuth').mockReturnValue({ user: null } as ReturnType<typeof Auth.useAuth>);
    render(<UserProfileMenu />);
    expect(screen.getByRole('link', { name: 'Log in' })).toHaveAttribute('href', '/login');
  });
});
