import api from "@/lib/axios";

export type BattleIntegritySummary = { days: number; openSignals: number; highSeverity: number; flaggedPlayers: number; byType: Array<{ signalType: string; count: number }> };
export type BattleIntegrityEvent = { _id: string; severity: "low" | "medium" | "high"; signalType: string; userId: string; opponentUserId?: string | null; roomCode?: string | null; status: string; details: Record<string, unknown>; count: number; lastSeenAt: string };

export async function fetchBattleIntegritySummary(days = 7): Promise<BattleIntegritySummary> { return (await api.get(`/api/battle/admin/integrity/summary?days=${days}`)).data; }
export async function fetchBattleIntegrityEvents({ page = 1, status = "open", severity = "" } = {}) { const params = new URLSearchParams({ page: String(page), limit: "20", status }); if (severity) params.set("severity", severity); return (await api.get(`/api/battle/admin/integrity/events?${params}`)).data as { items: BattleIntegrityEvent[]; hasMore: boolean }; }
export async function reviewBattleIntegrityEvent(id: string, status: "reviewed" | "dismissed" | "escalated", note = "") { return (await api.patch(`/api/battle/admin/integrity/events/${id}`, { status, note })).data; }
