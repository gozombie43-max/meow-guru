import { registerBattleRelay } from "./battleOutbox.js";
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/mongo-adapter';
import { getSocketIoAdapterCollection } from '../config/mongodb.js';
import { setBattleRealtimeServer } from '../battle/battleRealtime.js';
import { setNotificationRealtimeServer } from '../services/notificationRealtime.js';

export function startWorkerRealtime() {
  // A publishing-only adapter participant: no HTTP server or public listener.
  const io = new Server();
  io.adapter(createAdapter(getSocketIoAdapterCollection(), { addCreatedAtField: true }));
  registerBattleRelay(io, false);
  setBattleRealtimeServer(io);
  setNotificationRealtimeServer(io);
  return async () => {
    setBattleRealtimeServer(null);
    setNotificationRealtimeServer(null);
    await io.of('/').adapter.close();
  };
}
