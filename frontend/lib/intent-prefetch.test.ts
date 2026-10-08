import { expect, it, vi } from 'vitest';
import { prefetchOnce } from './intent-prefetch';
it('coalesces intent events and permits a new prefetch after route invalidation', () => {
  const prefetch = vi.fn(); const router = { prefetch };
  prefetchOnce(router, '/intent-one'); prefetchOnce(router, '/intent-one'); prefetchOnce(router, '/intent-one');
  expect(prefetch).toHaveBeenCalledTimes(1);
  prefetch.mock.calls[0][1].onInvalidate();
  prefetchOnce(router, '/intent-one'); expect(prefetch).toHaveBeenCalledTimes(2);
});
it('permits retry after failure and bounds the freshness guard', () => {
  const prefetch = vi.fn().mockImplementationOnce(() => { throw new Error('navigation unavailable'); });
  prefetchOnce({ prefetch }, '/intent-two'); prefetchOnce({ prefetch }, '/intent-two');
  expect(prefetch).toHaveBeenCalledTimes(2);
  const clock = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 60_001);
  prefetchOnce({ prefetch }, '/intent-two'); expect(prefetch).toHaveBeenCalledTimes(3); clock.mockRestore();
});
