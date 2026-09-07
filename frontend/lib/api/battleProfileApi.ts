import api from "@/lib/axios";
export async function fetchBattleProfile() { return (await api.get("/api/battle/profile")).data; }
export async function fetchBattlePlayerSummary(userId: string) { return (await api.get(`/api/battle/players/${encodeURIComponent(userId)}/summary`)).data; }
