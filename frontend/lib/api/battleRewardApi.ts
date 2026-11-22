import api from "@/shared/api/client";

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

function createRewardClaimIdempotencyKey(level: number): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `battle-reward-${level}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchBattleRewardTrack(options?: { signal?: AbortSignal }) {
  return (
    await api.get<BattleRewardTrack>(
      "/api/battle/season/reward-track",
      options?.signal ? { signal: options.signal } : undefined
    )
  ).data;
}

export async function claimBattleSeasonReward(
  level: number,
  options?: { idempotencyKey?: string; signal?: AbortSignal }
) {
  const idempotencyKey = options?.idempotencyKey || createRewardClaimIdempotencyKey(level);
  return (
    await api.post(
      `/api/battle/season/reward-track/${level}/claim`,
      {},
      {
        headers: { "Idempotency-Key": idempotencyKey },
        ...(options?.signal ? { signal: options.signal } : {}),
      }
    )
  ).data;
}

export async function fetchBattleCosmetics() { return (await api.get("/api/battle/cosmetics")).data; }
export async function equipBattleCosmetic(cosmeticCode: string) { return (await api.put("/api/battle/cosmetics/equip", { cosmeticCode })).data; }
