import { afterEach, expect, it, vi } from 'vitest';
import { canRetry, retryDelay } from './policy';
afterEach(() => vi.restoreAllMocks());
it('requires idempotency for write retries even when retryMethods includes POST', () => {
  expect(canRetry('POST', 503, { retryMethods: ['POST'] })).toBe(false);
  expect(canRetry('POST', 503, {}, 'action-123')).toBe(true);
  expect(canRetry('POST', 409, {}, 'action-123')).toBe(false);
});
it('adds exponential jitter and waits at least Retry-After without truncating it', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  expect(retryDelay(1, { retryDelayMs: 1000 })).toBe(2200);
  expect(retryDelay(0, {}, '60')).toBeGreaterThanOrEqual(60000);
});
