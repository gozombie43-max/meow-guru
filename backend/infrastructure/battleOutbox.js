import { getBattleRoomsCollection } from '../config/mongodb.js';
import { getBattleRealtimeServer } from '../battle/battleRealtime.js';
import { logger } from './logger.js';

export const RELAY_EVENT = 'runtime:battle-relay';
export function registerBattleRelay(io, api = true) {
  io.on(RELAY_EVENT, (messages, acknowledge) => {
    if (api) for (const message of messages) io.local.to(message.target).emit(message.event, message.payload);
    acknowledge({ api });
  });
}
export async function relayPendingBattles(
  rooms = getBattleRoomsCollection(),
  io = getBattleRealtimeServer(),
  { localApi = false } = {},
) {
  if (!io) return;
  const pending = await rooms.find({ realtimeVersion: { $exists: true } }).limit(50).toArray();
  for (const room of pending) {
    const messages = room.players.map(player => {
      const opponent = room.players.find(other => other.userId !== player.userId);
      return room.status === 'waiting' && room.matchmakingId && opponent
        ? { target: `user:${player.userId}`, event: 'matchmaking:matched', payload: { roomCode: room.code, matchmakingId: room.matchmakingId, opponent: { userId: opponent.userId, name: opponent.name, rating: opponent.matchmakingRating }, ratingDifference: Math.abs(player.matchmakingRating - opponent.matchmakingRating), subject: room.subject, topic: room.topic, questionCount: room.questionCount } }
        : { target: `user:${player.userId}`, event: 'battle:syncRequired', payload: { code: room.code } };
    });
    let relayed = false;
    if (localApi) {
      for (const message of messages) {
        io.local.to(message.target).emit(message.event, message.payload);
      }
      relayed = true;
    } else {
      const responses = await io.serverSideEmitWithAck(RELAY_EVENT, messages);
      relayed = responses.some(response => response.api);
    }
    if (relayed) {
      await rooms.updateOne({ _id: room._id, realtimeVersion: room.realtimeVersion }, { $unset: { realtimeVersion: '' } });
    }
  }
}
export function startBattleOutbox(options) {
  let running, stopping = false;
  const tick = () => {
    if (running || stopping) return;
    running = relayPendingBattles(undefined, undefined, options).catch(err => logger.error({ err }, 'battle relay failed')).finally(() => { running = null; });
  };
  tick();
  const timer = setInterval(tick, 1000);
  return async () => { stopping = true; clearInterval(timer); await running; };
}
