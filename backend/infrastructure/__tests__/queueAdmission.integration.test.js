import { randomUUID, createHash } from 'node:crypto';
import { Queue } from 'bullmq';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { queueConnection } from '../maintenanceQueue.js';
import { admitMaintenance } from '../queueAdmission.js';

describe.skipIf(!process.env.REDIS_TEST_URL)('distributed maintenance admission with real BullMQ', () => {
  let first, second, client;
  const policy = { QUEUE_MAX_WAITING_JOBS: 3, QUEUE_MAX_DELAYED_JOBS: 2, QUEUE_OWNER_MAX_ENQUEUES: 2, QUEUE_OWNER_WINDOW_MS: 60000 };
  beforeAll(async () => {
    const options = { connection: queueConnection(process.env.REDIS_TEST_URL), prefix: `admission-test-${randomUUID()}` };
    first = new Queue('maintenance', options); second = new Queue('maintenance', options);
    first.on('error', () => {}); second.on('error', () => {});
    await Promise.all([first.waitUntilReady(), second.waitUntilReady()]);
    client = await first.getBackend().client;
    await first.pause();
  });
  afterAll(async () => { await first?.obliterate({ force: true }); await Promise.all([first?.close(), second?.close()]); });
  async function enqueue(queue, id, owner, delay = 0, priority = 0) {
    const producer = await queue.getBackend().client;
    const release = await admitMaintenance(queue, producer, id, owner, delay, policy);
    try { return await queue.add('probe', {}, { jobId: id, delay, priority }); } finally { await release(); }
  }
  it('bounds simultaneous paused, prioritized and delayed backlogs across producers', async () => {
    const requests = await Promise.allSettled(Array.from({ length: 100 }, (_, index) => enqueue(index % 2 ? first : second, `waiting-${index}`, `owner-${index}`, 0, index % 2 ? 10 : 0)));
    expect(requests.filter(result => result.status === 'fulfilled')).toHaveLength(3);
    expect(requests.filter(result => result.status === 'rejected').every(result => result.reason.statusCode === 503)).toBe(true);
    expect(await client.llen(first.toKey('wait')) + await client.llen(first.toKey('paused')) + await client.zcard(first.toKey('prioritized'))).toBe(3);
    const delayed = await Promise.allSettled(Array.from({ length: 100 }, (_, index) => enqueue(index % 2 ? first : second, `delayed-${index}`, `delay-owner-${index}`, 60000)));
    expect(delayed.filter(result => result.status === 'fulfilled')).toHaveLength(2);
    expect(await first.getDelayedCount()).toBe(2);
    expect(await client.zcard(first.toKey('admission:waiting'))).toBe(0);
    expect(await client.zcard(first.toKey('admission:delayed'))).toBe(0);
  });
  it('uses one expiring owner counter and does not charge existing-job retries', async () => {
    await first.obliterate({ force: true }); await first.pause();
    await enqueue(first, 'owner-one', 'learner');
    await enqueue(second, 'owner-one', 'learner');
    await enqueue(second, 'owner-two', 'learner');
    await expect(enqueue(first, 'owner-three', 'learner')).rejects.toMatchObject({ statusCode: 429 });
    const key = first.toKey(`admission:owner:${createHash('sha256').update('learner').digest('hex')}`);
    expect(await client.get(key)).toBe('2');
    expect(await client.pttl(key)).toBeGreaterThan(0); expect(await client.pttl(key)).toBeLessThanOrEqual(60000);
    expect(await first.getWaitingCount()).toBe(2);
  });
});
