import { describe, expect, it } from 'vitest';
import { formatLastSeen, formatOnlineCount } from './student-presence';

describe('formatLastSeen', () => {
  const now = 1_800_000_000_000;

  it('uses a just-now label for a recent disconnect', () => {
    expect(formatLastSeen(now - 30_000, now)).toBe('Last seen just now');
  });

  it('formats one minute with singular grammar', () => {
    expect(formatLastSeen(now - 60_000, now)).toBe('Last seen 1 minute ago');
  });

  it('formats multiple minutes', () => {
    expect(formatLastSeen(now - 5 * 60_000, now)).toBe('Last seen 5 minutes ago');
  });

  it('formats hours and days', () => {
    expect(formatLastSeen(now - 2 * 3_600_000, now)).toBe('Last seen 2 hours ago');
    expect(formatLastSeen(now - 3 * 86_400_000, now)).toBe('Last seen 3 days ago');
  });

  it('handles missing timestamps safely', () => {
    expect(formatLastSeen(0, now)).toBe('Last seen recently');
    expect(formatLastSeen(Number.NaN, now)).toBe('Last seen recently');
  });

  it('does not show a negative elapsed time for future timestamps', () => {
    expect(formatLastSeen(now + 60_000, now)).toBe('Last seen just now');
  });
});

describe('formatOnlineCount', () => {
  it('formats ordinary counts with Indian grouping', () => {
    expect(formatOnlineCount(125, false)).toBe('125');
  });

  it('marks a saturated scan as a lower bound', () => {
    expect(formatOnlineCount(1_000, true)).toBe('1,000+');
  });

  it('normalizes invalid and negative counts', () => {
    expect(formatOnlineCount(-4, false)).toBe('0');
    expect(formatOnlineCount(Number.NaN, false)).toBe('0');
  });
});
