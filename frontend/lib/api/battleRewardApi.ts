import api from "@/lib/axios";
export async function fetchBattleRewardTrack() { return (await api.get("/api/battle/season/reward-track")).data; }
export async function claimBattleSeasonReward(level: number) { return (await api.post(`/api/battle/season/reward-track/${level}/claim`)).data; }
export async function fetchBattleCosmetics() { return (await api.get("/api/battle/cosmetics")).data; }
export async function equipBattleCosmetic(cosmeticCode: string) { return (await api.put("/api/battle/cosmetics/equip", { cosmeticCode })).data; }
