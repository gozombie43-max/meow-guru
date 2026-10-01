import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createClient } from 'redis';
import { redisKey } from '../config/redis.js';

if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for the Redis smoke check');

const client = createClient({
  url: process.env.REDIS_URL,
  socket: { connectTimeout: 3000, reconnectStrategy: false },
});
client.on('error', () => {});
const key = redisKey(`smoke:${randomUUID()}`);
const counter = `${key}:counter`;
const stream = `${key}:stream`;
let subscriber;
try {
  await client.connect();
  await client.set(key, 'ready', { EX: 30 });
  if (await client.get(key) !== 'ready') throw new Error('Redis GET/SET failed');
  const hits = await client.eval("local n = redis.call('INCR', KEYS[1]); redis.call('EXPIRE', KEYS[1], 30); return n", {
    keys: [counter], arguments: [],
  });
  if (Number(hits) !== 1) throw new Error('Redis atomic counter failed');
  await client.sendCommand(['XADD', stream, '*', 'check', 'ok']);
  const entries = await client.sendCommand(['XRANGE', stream, '-', '+']);
  if (!Array.isArray(entries) || entries.length !== 1) throw new Error('Redis Streams failed');

  subscriber = client.duplicate();
  subscriber.on('error', () => {});
  await subscriber.connect();
  let receive;
  const message = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Redis Pub/Sub timed out')), 2000);
    receive = value => { clearTimeout(timer); resolve(value); };
  });
  await subscriber.subscribe(`${key}:channel`, receive);
  await client.publish(`${key}:channel`, 'ok');
  if (await message !== 'ok') throw new Error('Redis Pub/Sub failed');
  console.log('Redis counter, cache, Streams, and Pub/Sub smoke checks passed');
} finally {
  await client.del([key, counter, stream]).catch(() => {});
  subscriber?.destroy();
  client.destroy();
}
