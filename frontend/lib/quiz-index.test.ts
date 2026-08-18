import { describe, it, expect } from 'vitest';
import { normalizeExamLabel } from './quiz-index';

describe('normalizeExamLabel', () => {
  it('handles empty, nullish or whitespace inputs', () => {
    // @ts-expect-error testing invalid input
    expect(normalizeExamLabel(null)).toBe('');
    // @ts-expect-error testing invalid input
    expect(normalizeExamLabel(undefined)).toBe('');
    expect(normalizeExamLabel('')).toBe('');
    expect(normalizeExamLabel('   ')).toBe('');
  });

  it('matches specific SSC CGL cases', () => {
    expect(normalizeExamLabel('ssc cgl')).toBe('SSC CGL');
    expect(normalizeExamLabel('SSC CGL 2023')).toBe('SSC CGL');
    expect(normalizeExamLabel('ssc cgl tier ii exam')).toBe('SSC CGL Tier II');
    expect(normalizeExamLabel('SSC CGL (TIER II)')).toBe('SSC CGL Tier II');
  });

  it('matches specific SSC CHSL cases', () => {
    expect(normalizeExamLabel('ssc chsl')).toBe('SSC CHSL');
    expect(normalizeExamLabel('SSC CHSL 2023')).toBe('SSC CHSL');
    expect(normalizeExamLabel('ssc chsl tier ii exam')).toBe('SSC CHSL Tier II');
    expect(normalizeExamLabel('SSC CHSL (TIER II)')).toBe('SSC CHSL Tier II');
  });

  it('matches other specific exam labels', () => {
    expect(normalizeExamLabel('ssc cpo exam')).toBe('SSC CPO');
    expect(normalizeExamLabel('graduate level post')).toBe('Graduate Level');
    expect(normalizeExamLabel('higher secondary level')).toBe('Higher Secondary');
    expect(normalizeExamLabel('lecturer recruitment')).toBe('Lecturer');
    expect(normalizeExamLabel('delhi police exam')).toBe('Police');
    expect(normalizeExamLabel('railway recruitment board')).toBe('Railway');
  });

  it('cleans up regex-matched keywords and symbols (fallback branch)', () => {
    // Testing removal of shifts, sessions, sets, papers, slots, etc.
    expect(normalizeExamLabel('UPSC Shift 1')).toBe('UPSC');
    expect(normalizeExamLabel('UPSC Session 2')).toBe('UPSC');
    expect(normalizeExamLabel('UPSC Set A')).toBe('UPSC A'); // 'A' is not removed
    expect(normalizeExamLabel('UPSC Paper II')).toBe('UPSC II');
    expect(normalizeExamLabel('UPSC Slot 3')).toBe('UPSC');
    expect(normalizeExamLabel('UPSC Afternoon')).toBe('UPSC');
    expect(normalizeExamLabel('UPSC Morning')).toBe('UPSC');
    expect(normalizeExamLabel('UPSC Evening')).toBe('UPSC');

    // Testing removal of levels and tiers
    expect(normalizeExamLabel('UPSC Tier I')).toBe('UPSC');
    expect(normalizeExamLabel('UPSC Tier II')).toBe('UPSC'); // Ah, TIER I+ removes TIER I and TIER II because I+ matches one or more 'I's, so II is matched.

    // The regex: \b(?:\d{1,4}|\d{1,2}TH|\d{1,2}ND|\d{1,2}ST|\d{1,2}RD|SHIFT|SESSION|SET|PAPER|SLOT|AFTERNOON|MORNING|EVENING|TIER\s*I+|LEVEL)\b
    expect(normalizeExamLabel('Exam 2023')).toBe('Exam');
    expect(normalizeExamLabel('Exam 12th')).toBe('Exam');
    expect(normalizeExamLabel('Exam 2nd')).toBe('Exam');
    expect(normalizeExamLabel('Exam 1st')).toBe('Exam');
    expect(normalizeExamLabel('Exam 3rd')).toBe('Exam');

    // Testing symbol removal: [\(\)\[\],\/\-]+
    expect(normalizeExamLabel('Exam (2023) [Shift 1] - Paper / Set')).toBe('Exam');
    expect(normalizeExamLabel('Exam-Name, Here')).toBe('Exam Name Here');
  });

  it('cleans up extra whitespace', () => {
    expect(normalizeExamLabel('  Some   Exam   Name  ')).toBe('Some Exam Name');
  });
});
