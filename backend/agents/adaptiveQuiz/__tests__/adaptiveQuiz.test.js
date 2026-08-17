import { describe, it, expect, beforeEach } from 'vitest';
import { checkIsCorrect, quizSessionStore, pruneQuizSessions } from '../adaptiveQuizRouter.js';

describe('Adaptive Quiz Router', () => {
  describe('checkIsCorrect', () => {
    it('correctly matches direct string answers (case-insensitive)', () => {
      const key = {
        correctAnswer: 'New Delhi',
        options: ['Mumbai', 'Kolkata', 'New Delhi', 'Chennai'],
      };
      expect(checkIsCorrect('New Delhi', key)).toBe(true);
      expect(checkIsCorrect('new delhi', key)).toBe(true);
      expect(checkIsCorrect('Mumbai', key)).toBe(false);
    });

    it('correctly matches single-letter answers against correctLetter', () => {
      const key = {
        correctLetter: 'b',
        options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      };
      expect(checkIsCorrect('b', key)).toBe(true);
      expect(checkIsCorrect('B', key)).toBe(true);
      expect(checkIsCorrect('Option 2', key)).toBe(true);
      expect(checkIsCorrect('Option 1', key)).toBe(false);
    });

    it('correctly matches single-letter correctAnswer against option text', () => {
      const key = {
        correctAnswer: 'c',
        options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
      };
      expect(checkIsCorrect('Gamma', key)).toBe(true);
      expect(checkIsCorrect('c', key)).toBe(true);
      expect(checkIsCorrect('Beta', key)).toBe(false);
    });

    it('handles empty or missing answers gracefully', () => {
      const key = {
        correctAnswer: 'A',
      };
      expect(checkIsCorrect('', key)).toBe(false);
      expect(checkIsCorrect(null, key)).toBe(false);
      expect(checkIsCorrect(undefined, key)).toBe(false);
    });
  });

  describe('quizSessionStore', () => {
    beforeEach(() => {
      quizSessionStore.clear();
    });

    it('stores and retrieves session data', () => {
      const quizId = 'quiz_test_123';
      const sessionData = {
        answerKey: {
          q1: { correctAnswer: 'A', topic: 'Algebra' },
        },
        userId: 'user1',
        createdAt: Date.now(),
      };

      quizSessionStore.set(quizId, sessionData);
      expect(quizSessionStore.get(quizId)).toEqual(sessionData);
    });

    it('prunes expired sessions', () => {
      const now = Date.now();
      quizSessionStore.set('fresh_quiz', {
        answerKey: {},
        userId: 'user1',
        createdAt: now,
      });
      quizSessionStore.set('old_quiz', {
        answerKey: {},
        userId: 'user2',
        createdAt: now - 10000,
      });

      pruneQuizSessions(5000); // 5s max age
      expect(quizSessionStore.has('fresh_quiz')).toBe(true);
      expect(quizSessionStore.has('old_quiz')).toBe(false);
    });
  });
});
