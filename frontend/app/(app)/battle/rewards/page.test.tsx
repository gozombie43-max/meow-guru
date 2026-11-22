// @vitest-environment jsdom
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import BattleRewardsPage from './page';
import api from '@/shared/api/client';

const authState = vi.hoisted(() => ({
  user: { id: 'u1', name: 'Player 1', email: 'p1@test.com', progress: {}, bookmarks: [] } as {
    id: string;
    name: string;
    email: string;
    progress: Record<string, never>;
    bookmarks: string[];
  } | null,
  token: 'valid-jwt' as string | null,
  loading: false,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => authState,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/battle/rewards',
}));

vi.mock('@/shared/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

const sampleTrack = {
  season: { name: 'Season 4: Thunder Arena' },
  level: 3,
  items: [
    {
      level: 1,
      claimed: true,
      unlocked: true,
      claimable: false,
      reward: { name: 'Bronze Crest', type: 'badge' },
    },
    {
      level: 2,
      claimed: false,
      unlocked: true,
      claimable: true,
      reward: { name: 'Thunder Title', type: 'title' },
    },
    {
      level: 3,
      claimed: false,
      unlocked: false,
      claimable: false,
      reward: { name: 'Apex Frame', type: 'frame' },
    },
  ],
};

describe('BattleRewardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authState.user = { id: 'u1', name: 'Player 1', email: 'p1@test.com', progress: {}, bookmarks: [] };
    authState.token = 'valid-jwt';
    authState.loading = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('does not fetch reward track while auth is bootstrapping or unauthenticated', async () => {
    authState.loading = true;
    authState.user = null;
    authState.token = null;

    const { rerender } = render(<BattleRewardsPage />);
    expect(api.get).not.toHaveBeenCalled();

    authState.loading = false;
    rerender(<BattleRewardsPage />);

    expect(api.get).not.toHaveBeenCalled();
    expect(await screen.findByText(/Sign in to view your battle rewards/i)).toBeInTheDocument();
  });

  it('renders an alert error state on network failure and recovers on retry', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('Network offline'))
      .mockResolvedValueOnce({ data: sampleTrack });

    render(<BattleRewardsPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Could not load the season reward track/i);

    const retryButton = screen.getByRole('button', { name: /Try again/i });
    fireEvent.click(retryButton);

    expect(await screen.findByText('Season 4: Thunder Arena')).toBeInTheDocument();
    expect(screen.getByText('Thunder Title')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('prevents duplicate claims on rapid double-click and sends an Idempotency-Key header', async () => {
    let resolveClaim!: (value: { data: { ok: boolean } }) => void;
    const claimPromise = new Promise<{ data: { ok: boolean } }>((resolve) => {
      resolveClaim = resolve;
    });

    vi.mocked(api.get)
      .mockResolvedValueOnce({ data: sampleTrack })
      .mockResolvedValueOnce({
        data: {
          ...sampleTrack,
          items: sampleTrack.items.map((item) =>
            item.level === 2 ? { ...item, claimed: true, claimable: false } : item
          ),
        },
      });
    vi.mocked(api.post).mockReturnValueOnce(claimPromise as never);

    render(<BattleRewardsPage />);

    const claimButton = await screen.findByRole('button', { name: 'Claim' });

    // Rapid double click before state re-renders
    fireEvent.click(claimButton);
    fireEvent.click(claimButton);

    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith(
      '/api/battle/season/reward-track/2/claim',
      {},
      expect.objectContaining({
        headers: expect.objectContaining({
          'Idempotency-Key': expect.any(String),
        }),
      })
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Claiming/i })).toBeDisabled();
    });

    resolveClaim({ data: { ok: true } });

    await waitFor(() => {
      expect(screen.getAllByText('✓ Claimed')).toHaveLength(2);
    });
  });
});
