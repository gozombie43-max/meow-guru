import { getBattleFeatures } from '../config/battleFeatures.js';

export function battlePolicy(origin = 'private') {
  const rated = origin === 'matchmaking' && getBattleFeatures().rankedEnabled;
  return { origin, mode: rated ? 'ranked' : 'casual', rated };
}

// Legacy rooms and client-supplied fields never opt a match into ratings.
export const isRatedBattle = room => room?.origin === 'matchmaking' && room.mode === 'ranked'
  && room.rated === true && Boolean(room.matchmakingId) && getBattleFeatures().rankedEnabled;
