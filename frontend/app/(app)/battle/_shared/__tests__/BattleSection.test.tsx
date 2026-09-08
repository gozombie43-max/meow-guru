import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BattleSection } from '../BattleSection';

vi.mock('next/navigation', () => ({
  usePathname: () => '/battle/profile',
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user_1', name: 'Goku' },
    loading: false,
    token: 'fake_token',
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useThemeMode: () => ({
    theme: 'dark',
    toggleThemeMode: vi.fn(),
  }),
}));

describe('BattleSection', () => {
  it('renders fixed header with back link, brand, theme toggle, and scrollable container', () => {
    const { container } = render(
      <BattleSection title="Your profile" description="Every battle adds to your story.">
        <div data-testid="profile-content">Profile Items</div>
      </BattleSection>
    );

    // Header elements
    const header = container.querySelector('.bs-header');
    expect(header).toBeDefined();

    const backLink = screen.getByRole('link', { name: /back to battle/i });
    expect(backLink.getAttribute('href')).toBe('/battle');

    expect(screen.getByText('Battle arena')).toBeDefined();
    expect(screen.getByRole('button', { name: /use light theme/i })).toBeDefined();

    // Fixed page layout and scrollable body
    expect(container.querySelector('.bs-page')).toBeDefined();
    expect(container.querySelector('.bs-scroll-body')).toBeDefined();
    expect(container.querySelector('.bs-content')).toBeDefined();

    // Content rendered inside
    expect(screen.getByTestId('profile-content')).toBeDefined();
    expect(screen.getByText('Profile Items')).toBeDefined();

    // Navigation tabs
    expect(screen.getByRole('link', { name: 'Profile' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Leaderboard' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Missions' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Social' })).toBeDefined();
  });
});
