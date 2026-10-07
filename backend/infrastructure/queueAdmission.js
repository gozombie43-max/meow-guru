import { createHash, randomUUID } from 'node:crypto';

// Snapshot and reserve pending admission atomically across all producers. Both
// priority/paused waiting lists and delayed jobs count; active jobs are excluded.
const RESERVE = `
local clock = redis.call('TIME')
local now = tonumber(clock[1])*1000 + math.floor(tonumber(clock[2])/1000)
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[9]) == 1 then return 2 end
redis.call('ZREMRANGEBYSCORE', KEYS[6], '-inf', now)
redis.call('ZREMRANGEBYSCORE', KEYS[7], '-inf', now)
local waiting = redis.call('LLEN', KEYS[2]) + redis.call('LLEN', KEYS[3]) + redis.call('ZCARD', KEYS[4]) + redis.call('ZCARD', KEYS[6])
local delayed = redis.call('ZCARD', KEYS[5]) + redis.call('ZCARD', KEYS[7])
if ARGV[2] == 'waiting' and waiting >= tonumber(ARGV[3]) then return -1 end
if ARGV[2] == 'delayed' and delayed >= tonumber(ARGV[4]) then return -2 end
if tonumber(redis.call('GET', KEYS[8]) or '0') >= tonumber(ARGV[5]) then return -3 end
local reservation = ARGV[2] == 'waiting' and KEYS[6] or KEYS[7]
redis.call('ZADD', reservation, now + 30000, ARGV[1])
redis.call('PEXPIRE', reservation, 60000)
local hits = redis.call('INCR', KEYS[8])
if hits == 1 then redis.call('PEXPIREAT', KEYS[8], (math.floor(now / tonumber(ARGV[6])) + 1) * tonumber(ARGV[6])) end
return 1`;

export async function admitMaintenance(queue, client, jobId, ownerId, delay, policy) {
  const owner = createHash('sha256').update(String(ownerId)).digest('hex');
  // Fixed-window key chosen with Redis TIME inside Lua: key has a single counter
  // and server-clock expiry, so it cannot grow with request IDs or window numbers.
  const ownerKey = queue.toKey(`admission:owner:${owner}`);
  const reservations = [queue.toKey('admission:waiting'), queue.toKey('admission:delayed')];
  const token = randomUUID();
  const result = Number(await client.eval(RESERVE, 9, queue.toKey(jobId), queue.toKey('wait'), queue.toKey('paused'), queue.toKey('prioritized'), queue.toKey('delayed'), ...reservations, ownerKey, queue.toKey(`de:${jobId}`),
    token, delay ? 'delayed' : 'waiting', policy.QUEUE_MAX_WAITING_JOBS, policy.QUEUE_MAX_DELAYED_JOBS, policy.QUEUE_OWNER_MAX_ENQUEUES, policy.QUEUE_OWNER_WINDOW_MS));
  if (result < 0) throw Object.assign(new Error(['', 'Maintenance waiting backlog is full', 'Maintenance delayed backlog is full', 'Maintenance owner enqueue limit reached'][-result]), {
    code: 'QUEUE_ADMISSION_REJECTED', statusCode: result === -3 ? 429 : 503, retryAfterMs: policy.QUEUE_OWNER_WINDOW_MS,
  });
  return async () => { if (result === 1) await client.zrem(delay ? reservations[1] : reservations[0], token); };
}
