export const DEFAULT_BATTLE_RATING = 1200;
const K_FACTOR = 32;

export function calculateElo({ ratingA, ratingB, resultA }) {
  const expectedA = 1 / (1 + 10 ** ((ratingB - ratingA) / 400));
  const deltaA = Math.round(K_FACTOR * (resultA - expectedA));
  const deltaB = deltaA === 0 ? 0 : -deltaA;
  return {
    newRatingA: Math.max(100, ratingA + deltaA),
    newRatingB: Math.max(100, ratingB - deltaA),
    deltaA,
    deltaB,
  };
}
