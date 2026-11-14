'use client';

import { useEffect, useState } from 'react';
import { claimBattleSeasonReward, fetchBattleRewardTrack, type BattleRewardTrack } from '@/lib/api/battleRewardApi';
import { ListingTemplate, Card, Badge, Button } from '@/design-system';

export default function BattleRewardsPage() {
  const [data, setData] = useState<BattleRewardTrack | null>(null);

  const load = () => {
    void fetchBattleRewardTrack().then(setData);
  };

  useEffect(() => {
    load();
  }, []);

  const intro = data?.season ? (
    <div className="mb-2">
      <p className="text-xs font-bold tracking-wider uppercase text-[var(--meow-accent)]">SEASON REWARDS</p>
      <h1 className="mt-1 text-2xl font-black text-[var(--meow-text)] sm:text-3xl">{data.season.name}</h1>
      <p className="mt-1 text-sm text-[var(--meow-muted)]">Reward Track · Season Level {data.level}</p>
    </div>
  ) : null;

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
      isLoading={!data}
      isEmpty={Boolean(data && !data.season)}
      defaultLoadingLabel="Loading reward track…"
      emptyState={
        <Card padding="lg" className="text-center text-[var(--meow-muted)]">
          <p className="text-sm font-semibold">No active reward track.</p>
          <p className="mt-1 text-xs">Check back when the next battle season starts.</p>
        </Card>
      }
    >
      {data?.items.map((item) => (
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
                  onClick={() => void claimBattleSeasonReward(item.level).then(load)}
                >
                  Claim
                </Button>
              ) : (
                <Badge variant="neutral" size="sm" aria-label="Locked">
                  🔒 Locked
                </Badge>
              )}
            </div>
          </div>
        </Card>
      ))}
    </ListingTemplate>
  );
}
