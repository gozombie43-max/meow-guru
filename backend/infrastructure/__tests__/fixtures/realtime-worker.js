import { connectMongoDB, disconnectMongoDB, getBattleRoomsCollection } from '../../../config/mongodb.js';
import { startWorkerRealtime } from '../../workerRealtime.js';
import { startBattleOutbox } from '../../battleOutbox.js';
import { emitNotificationToUser } from '../../../services/notificationRealtime.js';
await connectMongoDB();
const close = startWorkerRealtime();
const stopOutbox = startBattleOutbox();
process.on('message', async message => {
  try {
    if (message === 'relay') {
      const deadline = Date.now() + 12000;
      while (await getBattleRoomsCollection().countDocuments({ realtimeVersion: { $exists: true } })) {
        if (Date.now() > deadline) throw new Error('outbox did not drain');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      process.send('relayed');
    }
    if (message === 'notify') emitNotificationToUser('a', { title: 'worker notification' });
    if (message === 'stop') { await stopOutbox(); await close(); await disconnectMongoDB(); process.exit(0); }
  } catch (error) { process.send({ error: error.message }); }
});
process.send('ready');
