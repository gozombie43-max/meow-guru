import { expect, it, vi } from 'vitest';
import { createProviderGate } from '../providerGate.js';
it('rejects overload without queueing and releases capacity after completion', async () => {
  const gate = createProviderGate({ concurrency: 1 });
  let release;
  const pending = gate(() => new Promise(resolve => { release = resolve; }));
  await expect(gate(() => 'overflow')).rejects.toMatchObject({ statusCode: 503 });
  release('done'); await expect(pending).resolves.toBe('done');
  await expect(gate(() => 'next')).resolves.toBe('next');
});
it('opens after repeated failures and allows recovery after cooldown', async () => {
  vi.useFakeTimers();
  try {
    const gate = createProviderGate({ failureThreshold: 2, cooldownMs: 100 });
    const fail = () => Promise.reject(new Error('unavailable'));
    await expect(gate(fail)).rejects.toThrow(); await expect(gate(fail)).rejects.toThrow();
    await expect(gate(() => 'blocked')).rejects.toMatchObject({ statusCode: 503 });
    vi.advanceTimersByTime(101); await expect(gate(() => 'recovered')).resolves.toBe('recovered');
  } finally { vi.useRealTimers(); }
});
