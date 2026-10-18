import { describe, expect, it } from 'vitest';
import { paperDate } from './paper-date';
import type { MockTestSlot } from './exam-config';

const slot = (values: Partial<MockTestSlot>): MockTestSlot => ({
  id: 'paper', examSlug: 'ssc-chsl', configKey: 'ssc-chsl-tier1',
  title: 'Official paper', isFree: true, order: 1, ...values,
});

describe('paperDate', () => {
  it('prefers the saved calendar date without shifting it by timezone', () => {
    expect(paperDate(slot({ examDate: '2025-11-12T23:30:00-05:00', title: '13 November 2025' })))
      .toEqual({ year: 2025, month: 'NOV', day: 12, iso: '2025-11-12' });
  });
  it('reads older title dates and a separately saved year', () => {
    expect(paperDate(slot({ title: 'SSC CHSL 12 November (SHIFT 3) Official Paper', year: 2025 })))
      .toEqual({ year: 2025, month: 'NOV', day: 12, iso: '2025-11-12' });
    expect(paperDate(slot({ title: 'SSC CHSL 13-Nov-2025 (SHIFT 1)' }))?.day).toBe(13);
  });
  it('does not invent dates for undated papers or invalid calendar dates', () => {
    expect(paperDate(slot({ year: 2025 }))).toBeNull();
    expect(paperDate(slot({ title: '31 February 2025 Official Paper' }))).toBeNull();
    expect(paperDate(slot({ examDate: '2025-02-29' }))).toBeNull();
    expect(paperDate(slot({ examDate: '2024-02-29' }))?.day).toBe(29);
  });
});
