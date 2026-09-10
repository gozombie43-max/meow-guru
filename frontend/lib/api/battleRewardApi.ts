import api from "@/lib/axios";

export interface BattleRewardTrackItem {
  level: number;
  claimed: boolean;
  unlocked: boolean;
  claimable: boolean;
  reward: { name: string; type: string };
}

export interface BattleRewardTrack {
  season: { name: string } | null;
  level: number;
  items: BattleRewardTrackItem[];
}

export async function fetchBattleRewardTrack() { return (await api.get<BattleRewardTrack>("/api/battle/season/reward-track")).data; }
export async function claimBattleSeasonReward(level: number) { return (await api.post(`/api/battle/season/reward-track/${level}/claim`)).data; }
export async function fetchBattleCosmetics() { return (await api.get("/api/battle/cosmetics")).data; }
export async function equipBattleCosmetic(cosmeticCode: string) { return (await api.put("/api/battle/cosmetics/equip", { cosmeticCode })).data; }
