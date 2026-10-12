import { describe, it, expect } from 'vitest';
import { getExamConfig, getMaxMarks, getTotalQuestions, getSlotsForExam } from '../../config/exam-config.js';
import { gradeAttempt } from '../mock/mockGradingService.js';
import { mockAnswerCorrect } from '../mockAnswer.js';
import { validateQuestions, validateConfidentialUpload } from '../assessmentPolicy.js';
import { trainingQuestionMetadata } from '../training/domain/questionMetadata.js';
import { activePaper } from '../mockTestPresentation.js';
const options = ['one', 'two', 'three', 'four'];
describe('IIT JAM shared assessment support', () => {
  it('uses 60 questions, 100 marks and 180 minutes without invented published slots', () => {
    expect(getTotalQuestions('iit-jam-physics')).toBe(60);
    expect(getMaxMarks('iit-jam-physics')).toBe(100);
    expect(getExamConfig('iit-jam-physics').totalDurationMin).toBe(180);
    expect(getSlotsForExam('iit-jam-physics')).toEqual([]);
  });
  it('grades exact MSQ sets without partial credit and bounded NAT including zero', () => {
    const msq = { questionType: 'MSQ', options };
    expect(mockAnswerCorrect(msq, ['2', '0'], ['A', 'C'])).toBe(true);
    for (const picked of [['0'], ['0', '1', '2'], ['0', '0'], []]) expect(mockAnswerCorrect(msq, picked, ['A', 'C'])).toBe(false);
    const nat = { questionType: 'NAT' };
    expect(mockAnswerCorrect(nat, '0', { min: -0.01, max: 0.01 })).toBe(true);
    expect(mockAnswerCorrect(nat, '0.02', { min: -0.01, max: 0.01 })).toBe(false);
    expect(mockAnswerCorrect(nat, '', 0)).toBe(false);
    expect(mockAnswerCorrect(nat, 'no', 0)).toBe(false);
  });
  it('applies distinct MCQ penalties and no MSQ/NAT penalties', () => {
    const config = getExamConfig('iit-jam-physics');
    const paper = { sections: config.sections.map(s => ({ key: s.key, questions: [{ id: s.key, questionType: s.questionType, options: s.questionType === 'NAT' ? [] : options }] })) };
    const result = gradeAttempt({ attemptDoc: { configKey: config.key, paper, answers: { a1: '1', a2: '1', b: ['0'], c1: '0', c2: '4' }, answerKey: { a1: 'A', a2: 'A', b: ['A', 'C'], c1: { min: 0, max: 0 }, c2: 5 } } });
    expect(result.totalScore).toBe(0);
    expect(result.sections.map(s => s.score)).toEqual([-0.33, -0.67, 0, 1, 0]);
  });
  it('validates complete JAM paper types and does not expose answer ranges while active', () => {
    expect(() => validateQuestions([{ id: 'nat', questionType: 'NAT', correctAnswer: { min: 1, max: 2 } }, { id: 'msq', questionType: 'MSQ', options, correctAnswer: ['A', 'C'] }])).not.toThrow();
    expect(() => validateQuestions([{ id: 'nat', questionType: 'NAT', correctAnswer: { min: 2, max: 1 } }])).toThrow();
    expect(() => validateConfidentialUpload({ configKey: 'iit-jam-physics' }, [])).toThrow(/exactly/);
    const paper = activePaper({ sections: [{ questions: [{ id: 'nat', questionType: 'NAT', correctAnswer: { min: 1, max: 2 }, solution: 'secret' }] }] });
    expect(paper.sections[0].questions[0]).toEqual({ id: 'nat', questionType: 'NAT' });
  });
  it('keeps JAM and SSC training metadata separate', () => {
    const row = { id: 'q', question: 'Test?', options, correctAnswer: 'A', subject: 'iit-jam-physics', topic: 'mechanics' };
    expect(trainingQuestionMetadata({ ...row, exam: 'IIT JAM Physics 2026' }).trainingExamSlugs).toEqual(['iit-jam-physics']);
    expect(trainingQuestionMetadata({ ...row, exam: 'ssc-cgl' }).trainingExamSlugs).toEqual(['ssc-cgl']);
  });
});
