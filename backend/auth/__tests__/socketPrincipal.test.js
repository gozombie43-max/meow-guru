import { expect, it, vi } from 'vitest';
vi.mock('../sessions.js', () => ({ assertSession: vi.fn() }));
import { createSocketPrincipal } from '../socketPrincipal.js';
import { invalidateSocketAuthorization } from '../socketInvalidation.js';
const decoded = { id: 'player', sid: 'session', exp: 1000 };
it('coalesces connection bursts and performs no authority reads for packets within the TTL', async () => {
  let now = 1000;
  const validate = vi.fn(async value => ({ ...value, role: 'student' }));
  const principal = createSocketPrincipal(decoded, { validate, now: () => now });
  try {
    await Promise.all(Array.from({ length: 100 }, () => principal.get()));
    await principal.get(); expect(validate).toHaveBeenCalledTimes(1);
    now += 10_001; await principal.get(); expect(validate).toHaveBeenCalledTimes(2);
    now = decoded.exp * 1000; await expect(principal.get()).rejects.toThrow('Session expired');
    expect(validate).toHaveBeenCalledTimes(2);
  } finally { principal.close(); }
});
it('rejects a cached or in-flight principal immediately on session or user invalidation', async () => {
  let release;
  const validate = vi.fn(() => new Promise(resolve => { release = resolve; })), onInvalidated = vi.fn();
  const principal = createSocketPrincipal(decoded, { validate, now: () => 1000, onInvalidated });
  const pending = principal.get();
  invalidateSocketAuthorization({ sid: decoded.sid, userId: decoded.id });
  release(decoded);
  await expect(pending).rejects.toThrow('Session expired'); await expect(principal.get()).rejects.toThrow();
  expect(onInvalidated).toHaveBeenCalledOnce(); principal.close();
  const other = createSocketPrincipal(decoded, { validate: async () => decoded, now: () => 1000, onInvalidated });
  await other.get(); invalidateSocketAuthorization({ userId: decoded.id });
  await expect(other.get()).rejects.toThrow(); other.close();
});
it('forces authoritative revalidation after subscriber failure and fails closed if it fails', async () => {
  const validate = vi.fn().mockResolvedValueOnce(decoded).mockRejectedValueOnce(new Error('revoked'));
  const principal = createSocketPrincipal(decoded, { validate, now: () => 1000 });
  try {
    await principal.get(); invalidateSocketAuthorization({ all: true, revalidate: true });
    await expect(principal.get()).rejects.toThrow('revoked'); expect(validate).toHaveBeenCalledTimes(2);
  } finally { principal.close(); }
});
