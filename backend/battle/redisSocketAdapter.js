import { createClient } from 'redis';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import { redisKey, reportRedisFailure } from '../config/redis.js';

export async function prepareBattleRedisAdapter() {
  if (process.env.BATTLE_REDIS_ADAPTER !== 'true') return null;
  if (!process.env.REDIS_URL) throw new Error('BATTLE_REDIS_ADAPTER requires REDIS_URL');
  const client = createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 1000, reconnectStrategy: retries => Math.min(1000 * 2 ** retries, 5000) },
  });
  client.on('error', reportRedisFailure);
  try {
    let timer;
    try {
      await Promise.race([
        client.connect(),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Battle Redis adapter connection timed out')), 3000); }),
      ]);
    } finally { clearTimeout(timer); }
    return {
      isReady: () => client.isReady,
      adapter: createAdapter(client, {
        streamName: redisKey('socket-stream'),
        channelPrefix: redisKey('socket-channel'),
        sessionKeyPrefix: redisKey('socket-session:'),
      }),
      close: () => { if (client.isOpen) client.destroy(); },
    };
  } catch (error) {
    client.destroy();
    throw error;
  }
}
