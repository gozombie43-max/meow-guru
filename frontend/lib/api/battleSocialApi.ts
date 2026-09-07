import api from "@/lib/axios";
export async function fetchBattleSocial() { return (await api.get("/api/battle/social")).data; }
export async function sendBattleFriendRequest(userId: string) { await api.post(`/api/battle/social/friends/${encodeURIComponent(userId)}`); }
export async function respondBattleFriendRequest(userId: string, action: "accept" | "decline") { await api.post(`/api/battle/social/friends/${encodeURIComponent(userId)}/respond`, { action }); }
export async function setBattleFavorite(userId: string, favorite: boolean) { await api.put(`/api/battle/social/favorites/${encodeURIComponent(userId)}`, { favorite }); }
export async function fetchBattleRivalry(userId: string) { return (await api.get(`/api/battle/players/${encodeURIComponent(userId)}/rivalry`)).data; }
