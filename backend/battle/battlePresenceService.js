import { getBattleRealtimeServer } from "./battleRealtime.js";
export async function isBattleUserOnline(userId) { const io = getBattleRealtimeServer(); if (!io) return false; try { return (await io.in(`user:${String(userId)}`).fetchSockets()).length > 0; } catch { return false; } }
export async function getOnlineBattleUsers(userIds) {
  const ids = [...new Set(userIds.filter(Boolean).map(String))];
  const result = Object.fromEntries(ids.map(id => [id, false]));
  const io = getBattleRealtimeServer();
  if (!io || !ids.length) return result;
  const wanted = new Set(ids);
  const sockets = await io.in(ids.map(id => `user:${id}`)).fetchSockets();
  for (const socket of sockets) for (const room of socket.rooms) {
    if (room.startsWith('user:') && wanted.has(room.slice(5))) result[room.slice(5)] = true;
  }
  return result;
}

export async function getConnectedBattleUserIds() {
  const io = getBattleRealtimeServer();
  if (!io) return [];
  const sockets = await io.fetchSockets();
  const ids = new Set();
  for (const socket of sockets) for (const room of socket.rooms) {
    if (room.startsWith('user:')) ids.add(room.slice(5));
  }
  return [...ids];
}
