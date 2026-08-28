import { describe, it, expect } from 'vitest';
import {
  normalizeSearchKey,
  normalizeQuizKey,
  matchesNormalizedTopic,
  isStudyModeRecord,
  buildQuestionsCacheKey,
} from '../questionService.js';

describe('Question Service Helpers', () => {
  it('normalizes search keys by trimming and removing punctuation', () => {
    expect(normalizeSearchKey('  Profit & Loss! ')).toBe('profitloss');
    expect(normalizeSearchKey('Time-and-Distance')).toBe('timeanddistance');
    expect(normalizeSearchKey(null)).toBe('');
  });

  it('normalizes quiz keys accurately', () => {
    expect(normalizeQuizKey('SSC CGL 2023 - Shift 1')).toBe('ssccgl2023shift1');
  });

  it('matches normalized topic candidates across question fields', () => {
    const question = {
      subject: 'Mathematics',
      chapter: 'Percentages',
      topic: 'percentages',
      quizTopic: 'percentages',
    };

    expect(matchesNormalizedTopic(question, 'percentages')).toBe(true);
    expect(matchesNormalizedTopic(question, 'algebra')).toBe(false);
  });

  it('handles synonyms and antonyms aliasing in matchesNormalizedTopic', () => {
    const question = {
      subject: 'English',
      chapter: 'Antonyms',
      topic: 'antonyms',
    };

    expect(matchesNormalizedTopic(question, 'synonymsantonyms')).toBe(true);
  });

  it('identifies study mode vocabulary records', () => {
    expect(isStudyModeRecord({ questionType: 'study-mode' })).toBe(true);
    expect(isStudyModeRecord({ quizName: 'Study Mode' })).toBe(true);
    expect(isStudyModeRecord({ word: 'Benevolent', meanings: ['Kind'] })).toBe(true);
    expect(isStudyModeRecord({ question: 'Regular MCQ Question', options: ['A', 'B'] })).toBe(false);
    expect(isStudyModeRecord(null)).toBe(false);
  });

  it('builds deterministic question cache keys', () => {
    const params = [
      { name: '@subject', value: 'mathematics' },
      { name: '@difficulty', value: 'medium' },
    ];
    const key1 = buildQuestionsCacheKey(params, 0, 20);
    const key2 = buildQuestionsCacheKey(params, 0, 20);
    expect(key1).toBe(key2);
    expect(typeof key1).toBe('string');
  });
});
