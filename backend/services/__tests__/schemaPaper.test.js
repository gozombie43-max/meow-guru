import { describe, expect, it } from 'vitest';
import { examPaperSchema, paperPresentation } from '@meow/contracts/exam-paper';
import { buildSchemaPaper } from '../mock/schemaPaperService.js';
import { sectionTiming } from '../mock/sectionTiming.js';
import { gradeAttempt } from '../mock/mockGradingService.js';
import { activePaper } from '../mockTestPresentation.js';

const question = id => ({ id, question: { en: `Question ${id}`, bn: `প্রশ্ন ${id}` },
  options: { en: ['one', 'two', 'three', 'four'], bn: ['এক', 'দুই', 'তিন', 'চার'] },
  answer: 'B', solution: { en: 'Private English explanation', bn: 'গোপন বাংলা ব্যাখ্যা' } });
const source = () => ({ exam: 'SSC_CHSL', tier: 2, type: 'MOCK', marksPerQuestion: 3, negativeMarks: 1,
  sections: { english: { duration: 1, questions: [question('e1'), question('e2')] },
    computer: { duration: 2, questions: [question('c1')] }, future_section: { duration: 3, questions: [question('f1')] } } });

describe('native bilingual paper contract', () => {
  it.each(['SSC_CGL', 'SSC_CHSL'])('supports %s tiers and test types without legacy metadata', exam => {
    for (const tier of [1, 2]) for (const type of ['MOCK', 'PYQ']) {
      expect(examPaperSchema.safeParse({ ...source(), exam, tier, type }).success).toBe(true);
    }
    expect(examPaperSchema.safeParse({ ...source(), paper: 1, examDate: '2025-11-13', shift: 1, skillTest: { type: 'DEST', duration: 15 } }).success).toBe(true);
  });
  it.each([
    paper => { paper.sections.computer.questions[0].id = 'e1'; },
    paper => { paper.sections.english.questions[0].options.bn.pop(); },
    paper => { delete paper.sections.english.questions[0].question.bn; },
    paper => { delete paper.sections.english.questions[0].solution.bn; },
    paper => { paper.sections.english.questions[0].answer = 'two'; },
    paper => { paper.sections.english.duration = -1; },
    paper => { paper.marksPerQuestion = 0; },
    paper => { paper.negativeMarks = -1; },
    paper => { paper.sections = {}; },
  ])('rejects malformed papers before import', change => {
    const paper = source(); change(paper);
    expect(examPaperSchema.safeParse(paper).success).toBe(false);
  });
  it('preserves ordered sections and IDs and strips every solution from active responses', () => {
    const { clientPaper, answerKey } = buildSchemaPaper(source());
    expect(clientPaper.sections.map(section => section.key)).toEqual(['english', 'computer', 'future_section']);
    expect(answerKey).toEqual({ e1: 'B', e2: 'B', c1: 'B', f1: 'B' });
    const safe = activePaper(clientPaper);
    expect(safe.sections[0].questions[0].translations.options.bn).toEqual(['এক', 'দুই', 'তিন', 'চার']);
    expect(JSON.stringify(safe)).not.toMatch(/solution|Private English|গোপন/);
    expect(clientPaper.sections[0].questions[0].translations.solution.bn).toBe('গোপন বাংলা ব্যাখ্যা');
  });
  it('grades by letter and uploaded marks, with zero penalty for unanswered questions', () => {
    const { clientPaper, answerKey } = buildSchemaPaper(source());
    const result = gradeAttempt({ attemptDoc: { paper: clientPaper, answerKey, answers: { e1: 'B', e2: 'A', c1: 'B' } } });
    expect(result.totalScore).toBe(5);
    expect(result.maxScore).toBe(12);
    expect(result.sections.map(section => [section.correct, section.incorrect, section.skipped])).toEqual([[1, 1, 0], [1, 0, 0], [0, 0, 1]]);
  });
});

describe('server sectional clocks', () => {
  const startedAt = new Date('2026-10-17T00:00:00.500Z');
  const attempt = () => ({ paper: paperPresentation(source()), startedAt });
  it('restores elapsed time, locks expired sections and carries background elapsed time forward', () => {
    const doc = attempt();
    const initial = sectionTiming(doc, startedAt.getTime());
    expect(initial.sectionRemainingTimes).toEqual({ english: 60, computer: 120, future_section: 180 });
    const next = sectionTiming({ ...doc, ...initial }, startedAt.getTime() + 65000);
    expect(next.timerSection).toBe(1);
    expect(next.lockedSections).toEqual(['english']);
    expect(next.sectionRemainingTimes).toEqual({ english: 0, computer: 115, future_section: 180 });
    const end = sectionTiming({ ...doc, ...next }, startedAt.getTime() + 1000000);
    expect(end.sectionsExhausted).toBe(true);
    expect(Object.values(end.sectionRemainingTimes)).toEqual([0, 0, 0]);
  });
  it('finishes early without resetting the following clock on later saves', () => {
    const doc = attempt();
    const next = sectionTiming(doc, startedAt.getTime() + 10000, true);
    expect(next.timerSection).toBe(1);
    expect(next.sectionRemainingTimes.computer).toBe(120);
    expect(sectionTiming({ ...doc, ...next }, startedAt.getTime() + 17000).sectionRemainingTimes.computer).toBe(113);
    expect(sectionTiming(doc, startedAt.getTime() + 65000, true).timerSection).toBe(1);
  });
  it('allows untimed papers and stops elapsed-time propagation at an untimed section', () => {
    const paper = source();
    delete paper.sections.computer.duration;
    const doc = { ...attempt(), paper: paperPresentation(paper) };
    const next = sectionTiming(doc, startedAt.getTime() + 1000000);
    expect(next.timerSection).toBe(1);
    expect(next.sectionRemainingTimes.computer).toBeNull();
    expect(next.sectionRemainingTimes.future_section).toBe(180);
    Object.values(paper.sections).forEach(section => delete section.duration);
    expect(sectionTiming({ ...doc, paper: paperPresentation(paper) })).toBeNull();
  });
});
