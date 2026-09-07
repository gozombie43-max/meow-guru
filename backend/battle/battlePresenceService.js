import { getBattleRealtimeServer } from "./battleRealtime.js";
export async function isBattleUserOnline(userId) { const io = getBattleRealtimeServer(); if (!io) return false; try { return (await io.in(`user:${String(userId)}`).fetchSockets()).length > 0; } catch { return false; } }
export async function getOnlineBattleUsers(userIds) { const ids = [...new Set(userIds.filter(Boolean).map(String))]; return Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await isBattleUserOnline(id)]))); }
