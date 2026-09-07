let battleIo = null;

export function setBattleRealtimeServer(io) {
  battleIo = io;
}

export function getBattleRealtimeServer() {
  return battleIo;
}
