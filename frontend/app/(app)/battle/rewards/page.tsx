'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import {
  claimBattleSeasonReward,
  fetchBattleRewardTrack,
  type BattleRewardTrack,
} from '@/lib/api/battleRewardApi';
import { ListingTemplate, Card, Badge, Button } from '@/design-system';

function isAbortedError(err: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  if (err && typeof err === 'object') {
    const candidate = err as { name?: string; code?: string };
    if (candidate.name === 'AbortError' || candidate.name === 'CanceledError' || candidate.code === 'ERR_CANCELED') {
      return true;
    }
  }
  return false;
}

export default function BattleRewardsPage() {
  const { user, token, loading: authLoading } = useAuth();
  const [data, setData] = useState<BattleRewardTrack | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);
  const claimingRef = useRef(false);
  const loadControllerRef = useRef<AbortController | null>(null);

  const isAuthenticated = !authLoading && Boolean(token && user);
  const activeData = isAuthenticated ? data : null;

  const load = useCallback(async () => {
    if (!token || !user) return;
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;

    try {
      const track = await fetchBattleRewardTrack({ signal: controller.signal });
      if (controller.signal.aborted) return;
      setData(track);
      setLoadError(null);
    } catch (err) {
      if (isAbortedError(err, controller.signal)) return;
      setLoadError('Could not load the season reward track. Please try again.');
    } finally {
      if (loadControllerRef.current === controller && !controller.signal.aborted) {
        setIsFetching(false);
      }
    }
  }, [token, user]);

  useEffect(() => {
    if (authLoading || !token || !user) {
      loadControllerRef.current?.abort();
      return;
    }
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      loadControllerRef.current?.abort();
    };
  }, [authLoading, token, user, load]);

  const handleRetry = useCallback(() => {
    setLoadError(null);
    setIsFetching(true);
    void load();
  }, [load]);

  const handleClaim = useCallback(
    async (level: number) => {
      if (claimingRef.current || !isAuthenticated) return;
      claimingRef.current = true;
      setClaimingLevel(level);
      setClaimError(null);

      try {
        await claimBattleSeasonReward(level);
        await load();
      } catch (err) {
        if (!isAbortedError(err)) {
          setClaimError('Could not claim reward. Please refresh and try again.');
        }
      } finally {
        claimingRef.current = false;
        setClaimingLevel(null);
      }
    },
    [isAuthenticated, load]
  );

  const intro = activeData?.season ? (
    <div className="mb-2">
      <p className="text-xs font-bold tracking-wider uppercase text-[var(--meow-accent)]">SEASON REWARDS</p>
      <h1 className="mt-1 text-2xl font-black text-[var(--meow-text)] sm:text-3xl">{activeData.season.name}</h1>
      <p className="mt-1 text-sm text-[var(--meow-muted)]">Reward Track · Season Level {activeData.level}</p>
    </div>
  ) : null;

  const isLoading = authLoading || (isAuthenticated && !activeData && !loadError) || isFetching;
  const isUnauthenticated = !authLoading && !isAuthenticated;

  return (
    <ListingTemplate
      headerProps={{
        title: 'Battle Rewards',
        backHref: '/battle/profile',
        backLabel: 'Battle Profile',
      }}
      intro={intro}
      columns={1}
      maxWidth={640}
      showBottomNav={false}
      showNavRail={false}
      isLoading={isLoading}
      error={loadError}
      onRetry={handleRetry}
      retryLabel="Try again"
      isEmpty={isUnauthenticated || Boolean(activeData && !activeData.season)}
      defaultLoadingLabel="Loading reward track…"
      emptyState={
        isUnauthenticated ? (
          <Card padding="lg" className="text-center text-[var(--meow-muted)]">
            <p className="text-sm font-semibold text-[var(--meow-text)]">Sign in to view your battle rewards</p>
            <p className="mt-1 text-xs">Your season reward track is linked to your account.</p>
            <div className="mt-3">
              <Link
                href="/login"
                data-ui-button="secondary"
                className="inline-flex items-center justify-center rounded-lg border border-[var(--meow-border)] px-4 py-2 text-xs font-semibold text-[var(--meow-text)]"
              >
                Sign in
              </Link>
            </div>
          </Card>
        ) : (
          <Card padding="lg" className="text-center text-[var(--meow-muted)]">
            <p className="text-sm font-semibold">No active reward track.</p>
            <p className="mt-1 text-xs">Check back when the next battle season starts.</p>
          </Card>
        )
      }
    >
      {claimError ? (
        <Card padding="md" variant="subtle" className="border-rose-500/40">
          <div role="alert" className="flex items-center justify-between gap-3 text-sm text-rose-600">
            <span>{claimError}</span>
            <Button size="sm" variant="secondary" onClick={handleRetry}>
              Refresh
            </Button>
          </div>
        </Card>
      ) : null}
      {activeData?.items.map((item) => {
        const isClaimingThis = claimingLevel === item.level;
        const isClaimingAny = claimingLevel !== null;
        return (
          <Card
            key={item.level}
            padding="md"
            variant={item.claimed ? 'accent-outline' : item.unlocked ? 'default' : 'subtle'}
            className="transition-colors"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <Badge variant={item.claimed ? 'success' : item.unlocked ? 'accent' : 'neutral'} size="sm">
                  LV {item.level}
                </Badge>
                <div className="mt-1 text-base font-bold text-[var(--meow-text)] sm:text-lg">
                  {item.reward.name}
                </div>
                <div className="text-xs text-[var(--meow-muted)] capitalize">
                  {item.reward.type}
                </div>
              </div>
              <div>
                {item.claimed ? (
                  <Badge variant="success" size="md">
                    ✓ Claimed
                  </Badge>
                ) : item.claimable ? (
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={isClaimingAny}
                    onClick={() => void handleClaim(item.level)}
                  >
                    {isClaimingThis ? 'Claiming…' : 'Claim'}
                  </Button>
                ) : (
                  <Badge variant="neutral" size="sm" aria-label="Locked">
                    🔒 Locked
                  </Badge>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </ListingTemplate>
  );
}
