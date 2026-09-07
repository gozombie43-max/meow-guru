export const PLACEMENT_GAMES = 5;

export const BATTLE_TIERS = [
  { name: "Bronze", minRating: 0 },
  { name: "Silver", minRating: 1100 },
  { name: "Gold", minRating: 1250 },
  { name: "Platinum", minRating: 1400 },
  { name: "Diamond", minRating: 1550 },
];

export function getBattleTier({ rating, gamesPlayed }) {
  const played = Number(gamesPlayed) || 0;
  if (played < PLACEMENT_GAMES) {
    return { name: "Unranked", placementGamesRemaining: Math.max(0, PLACEMENT_GAMES - played) };
  }

  const safeRating = Number(rating) || 1200;
  let tier = BATTLE_TIERS[0];
  for (const candidate of BATTLE_TIERS) {
    if (safeRating >= candidate.minRating) tier = candidate;
  }
  return { name: tier.name, placementGamesRemaining: 0 };
}
