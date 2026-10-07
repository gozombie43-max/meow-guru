import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  client: { isOpen: true, isReady: true, on: vi.fn(), connect: vi.fn(async () => {}), destroy: vi.fn() },
  createClient: vi.fn(),
  createAdapter: vi.fn(),
}));
vi.mock('redis', () => ({ createClient: state.createClient }));
vi.mock('@socket.io/redis-streams-adapter', () => ({ createAdapter: state.createAdapter }));
vi.mock('../../config/redis.js', () => ({ redisKey: key => `test:${key}`, reportRedisFailure: vi.fn() }));

import { prepareBattleRedisAdapter } from '../redisSocketAdapter.js';

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });

it('keeps the Mongo adapter when Battle Redis is not enabled', async () => {
  expect(await prepareBattleRedisAdapter()).toBeNull();
  expect(state.createClient).not.toHaveBeenCalled();
});

it('requires Redis and namespaces the recoverable Streams adapter', async () => {
  vi.stubEnv('BATTLE_REDIS_ADAPTER', 'true');
  await expect(prepareBattleRedisAdapter()).rejects.toThrow('requires REDIS_URL');
  vi.stubEnv('REDIS_URL', 'rediss://example.test');
  state.createClient.mockReturnValue(state.client);
  const factory = vi.fn();
  state.createAdapter.mockReturnValue(factory);
  const prepared = await prepareBattleRedisAdapter();
  expect(prepared.adapter).toBe(factory);
  expect(state.createAdapter).toHaveBeenCalledWith(state.client, expect.objectContaining({
    streamName: 'test:socket-stream',
    sessionKeyPrefix: 'test:socket-session:',
  }));
  prepared.close();
  expect(state.client.destroy).toHaveBeenCalled();
  state.client.isOpen = false; state.client.isReady = false;
  prepared.close(); expect(state.client.destroy).toHaveBeenCalledTimes(1);
  expect(prepared.isReady()).toBe(false);
});
