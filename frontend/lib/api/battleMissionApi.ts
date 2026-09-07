import api from "@/lib/axios";
export async function fetchBattleMissions() { return (await api.get("/api/battle/missions")).data; }
export async function claimBattleMission(id: string) { return (await api.post(`/api/battle/missions/${encodeURIComponent(id)}/claim`)).data; }
