import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../logger.js', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
let api;
beforeEach(async () => { vi.resetModules(); api = await import('../optionalServices.js'); });
it('isolates optional startup failures, reports health and cleans up partial starts', async () => {
  const cleanup = vi.fn();
  expect(await api.startOptionalService('queue', async () => { throw new Error('Redis offline'); }, { cleanup })).toBeNull();
  expect(api.optionalServiceHealth()).toEqual({ queue: 'unavailable' }); expect(cleanup).toHaveBeenCalledTimes(1);
  await api.startOptionalService('disabled', vi.fn(), { enabled: false });
  await api.startOptionalService('healthy', async () => 1, { cleanup });
  expect(api.optionalServiceReady('healthy')).toBe(true);
  await api.stopOptionalServices(); expect(cleanup).toHaveBeenCalledTimes(2);
});
it('retains explicit critical failure and cleans up startup racing with shutdown', async () => {
  await expect(api.startOptionalService('critical', async () => { throw new Error('critical'); }, { critical: true })).rejects.toThrow('critical');
  let release; const cleanup = vi.fn();
  const pending = api.startOptionalService('slow', () => new Promise(resolve => { release = resolve; }), { cleanup });
  await Promise.resolve(); const stopping = api.stopOptionalServices(); release(1); await pending; await stopping;
  expect(cleanup).toHaveBeenCalledTimes(1); expect(api.optionalServiceHealth().slow).toBe('disabled');
});
it('reports runtime degradation independently of startup and still drains that service', async () => {
  let ready = true; const cleanup = vi.fn();
  await api.startOptionalService('battle', async () => {}, { ready: () => ready, cleanup });
  expect(api.optionalServiceReady('battle')).toBe(true);
  ready = false; expect(api.optionalServiceReady('battle')).toBe(false);
  expect(api.optionalServiceHealth().battle).toBe('degraded');
  ready = true; expect(api.optionalServiceHealth().battle).toBe('healthy');
  ready = false; await api.stopOptionalServices(); expect(cleanup).toHaveBeenCalledTimes(1);
});
