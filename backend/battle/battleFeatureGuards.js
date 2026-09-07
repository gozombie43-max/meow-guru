import { getBattleFeatures, isUserInBattleRollout } from "../config/battleFeatures.js";
export const canCreateBattle = (userId) => isUserInBattleRollout(userId) && getBattleFeatures().newMatchesEnabled;
export const canUseMatchmaking = (userId) => canCreateBattle(userId) && getBattleFeatures().matchmakingEnabled;
