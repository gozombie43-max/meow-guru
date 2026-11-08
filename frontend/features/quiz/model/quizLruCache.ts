import type { QuizQuestion, SessionResult } from './types';
import type { QuizAnswerResponse } from './resumeDelta';

export const DEFAULT_QUIZ_CACHE_CAPACITY = 64;

export interface CachedAnswerEntry {
  questionId: string | number;
  revealed: QuizAnswerResponse;
  cachedAt: number;
}

/**
 * Strips any unrevealed answer key or explanation fields from a question before caching.
 * Unrevealed questions must always have `correctAnswer: -1`, `answer: ''`, and `solution: ''`.
 */
export function sanitizeUnrevealedQuestion(question: QuizQuestion): QuizQuestion {
  const cleanTranslations = question.translations
    ? {
        ...(question.translations.bn
          ? { bn: { question: question.translations.bn.question, options: question.translations.bn.options } }
          : {}),
        ...(question.translations.hi
          ? { hi: { question: question.translations.hi.question, options: question.translations.hi.options } }
          : {}),
      }
    : undefined;

  if (
    question.correctAnswer === -1 &&
    question.answer === '' &&
    question.solution === '' &&
    question.correctLetter === undefined &&
    !question.translations?.bn?.solution &&
    !question.translations?.hi?.solution
  ) {
    return question;
  }

  return {
    ...question,
    correctAnswer: question.correctAnswer >= 0 ? question.correctAnswer : -1,
    answer: question.correctAnswer >= 0 ? question.answer : '',
    solution: question.correctAnswer >= 0 ? question.solution : '',
    correctLetter: undefined,
    translations: question.correctAnswer >= 0 ? question.translations : cleanTranslations,
  };
}

/**
 * Merges a base `QuizQuestion` with an authoritative server `QuizAnswerResponse`.
 */
export function mergeQuestionWithReveal(
  rawQuestion: QuizQuestion,
  revealed: QuizAnswerResponse | undefined,
): QuizQuestion {
  if (!revealed) return rawQuestion;
  const correctAnswer =
    typeof revealed.correct === 'number' && revealed.correct >= 0
      ? revealed.correct
      : rawQuestion.correctAnswer;
  const solutionText = String(revealed.solution ?? '').trim();
  const solutionImageMarkdown = revealed.solutionImage
    ? `![solution](${revealed.solutionImage})`
    : '';
  const revealedSolution = solutionText
    ? /!\[[^\]]*\]\([^)]+\)/.test(solutionText) || !solutionImageMarkdown
      ? solutionText
      : `${solutionText}\n\n${solutionImageMarkdown}`
    : solutionImageMarkdown;

  return {
    ...rawQuestion,
    correctAnswer,
    answer:
      correctAnswer >= 0
        ? (rawQuestion.options[correctAnswer] ?? rawQuestion.answer)
        : rawQuestion.answer,
    solution: revealedSolution || rawQuestion.solution,
    translations: revealed.translations ?? rawQuestion.translations,
  };
}

interface CacheNode {
  index: number;
  questionId: string | number;
  question: QuizQuestion;
  prefetchedReveal?: QuizAnswerResponse;
  revealed?: QuizAnswerResponse;
  merged?: QuizQuestion;
}

/**
 * Bounded in-memory LRU cache for quiz questions, prefetched answer keys, and authoritative server answer reveals.
 * Keeps active/prefetched questions and previously answered questions ready for <1ms navigation and 0ms submit reveal.
 */
export class QuizLruCache {
  readonly sessionKey: string;
  private readonly capacity: number;
  private readonly map = new Map<number, CacheNode>();
  private pinnedIndices = new Set<number>();

  constructor(capacity = DEFAULT_QUIZ_CACHE_CAPACITY, sessionKey = 'default') {
    this.capacity = Math.max(4, capacity);
    this.sessionKey = sessionKey;
  }

  get size(): number {
    return this.map.size;
  }

  /**
   * Pins the active navigation window (e.g. currentIndex - 1 .. currentIndex + 2)
   * so active and prefetched questions are never evicted first.
   */
  pinWindow(currentIndex: number): void {
    this.pinnedIndices = new Set([
      Math.max(0, currentIndex - 1),
      currentIndex,
      currentIndex + 1,
      currentIndex + 2,
    ]);
  }

  hasQuestion(index: number, questionId?: string | number): boolean {
    const node = this.map.get(index);
    if (!node || node.question.sessionPlaceholder) return false;
    return questionId === undefined || node.questionId === questionId;
  }

  /**
   * Inserts or updates a question in the LRU cache and refreshes its recency.
   */
  setQuestion(index: number, question: QuizQuestion): QuizQuestion {
    if (!question || question.sessionPlaceholder) return question;
    const sanitized = sanitizeUnrevealedQuestion(question);
    const existing = this.map.get(index);

    if (existing) {
      this.map.delete(index);
      const sameQuestion = existing.questionId === sanitized.id;
      const prefetchedReveal = sameQuestion ? existing.prefetchedReveal : undefined;
      const revealed = sameQuestion ? existing.revealed : undefined;
      const sameBase = existing.question === sanitized && existing.revealed === revealed;
      const merged = sameBase && existing.merged
        ? existing.merged
        : mergeQuestionWithReveal(sanitized, revealed);
      const updated: CacheNode = {
        index,
        questionId: sanitized.id,
        question: sanitized,
        prefetchedReveal,
        revealed,
        merged,
      };
      this.map.set(index, updated);
      return updated.merged!;
    }

    this.evictIfNeeded(index);
    const merged = mergeQuestionWithReveal(sanitized, undefined);
    const node: CacheNode = {
      index,
      questionId: sanitized.id,
      question: sanitized,
      merged,
    };
    this.map.set(index, node);
    return merged;
  }

  /**
   * Stores a prefetched answer key/solution for an unsubmitted question in the active window
   * so clicking Submit reveals the correct/wrong option in 0ms without exposing it on unsubmitted questions.
   */
  setPrefetchedReveal(
    index: number,
    questionId: string | number | undefined,
    revealed: QuizAnswerResponse,
    fallbackQuestion?: QuizQuestion,
  ): void {
    let existing = this.map.get(index);
    if (!existing && fallbackQuestion && !fallbackQuestion.sessionPlaceholder) {
      this.setQuestion(index, fallbackQuestion);
      existing = this.map.get(index);
    }
    if (!existing) return;
    if (questionId !== undefined && existing.questionId !== questionId) return;
    this.map.delete(index);
    existing.prefetchedReveal = {
      ...existing.prefetchedReveal,
      ...revealed,
    };
    this.map.set(index, existing);
  }

  /**
   * Reads a prefetched or already-revealed answer key for instant 0ms grading on Submit.
   */
  getPrefetchedReveal(index: number, questionId?: string | number): QuizAnswerResponse | undefined {
    const existing = this.map.get(index);
    if (!existing) return undefined;
    if (questionId !== undefined && existing.questionId !== questionId) return undefined;
    return existing.revealed ?? existing.prefetchedReveal;
  }

  /**
   * Records an authoritative server answer reveal (or promotes a prefetched reveal upon submission) in the cache.
   */
  setAnswerResult(
    index: number,
    questionId: string | number | undefined,
    revealed: QuizAnswerResponse,
    fallbackQuestion?: QuizQuestion,
  ): QuizQuestion | undefined {
    let existing = this.map.get(index);
    if (!existing && fallbackQuestion && !fallbackQuestion.sessionPlaceholder) {
      this.setQuestion(index, fallbackQuestion);
      existing = this.map.get(index);
    }
    if (!existing) return undefined;
    if (questionId !== undefined && existing.questionId !== questionId) {
      return existing.merged;
    }
    this.map.delete(index);
    const mergedReveal: QuizAnswerResponse = {
      ...existing.prefetchedReveal,
      ...existing.revealed,
      ...revealed,
    };
    const merged = mergeQuestionWithReveal(existing.question, mergedReveal);
    const updated: CacheNode = {
      ...existing,
      prefetchedReveal: mergedReveal,
      revealed: mergedReveal,
      merged,
    };
    this.map.set(index, updated);
    return merged;
  }

  /**
   * Bulk-hydrates authoritative answer results from a resumed session.
   */
  hydrateFromResults(results: SessionResult[], questions: QuizQuestion[]): void {
    for (const row of results) {
      if (!row || !Number.isInteger(row.correct) || row.correct < 0) continue;
      const q = questions[row.questionIndex];
      if (q && !q.sessionPlaceholder) {
        this.setQuestion(row.questionIndex, q);
        this.setAnswerResult(
          row.questionIndex,
          row.questionId ?? q.id,
          { correct: row.correct, isCorrect: row.isCorrect },
          q,
        );
      }
    }
  }

  /**
   * Retrieves a question from the LRU cache (refreshing its recency) or populates it from `fallback`.
   */
  getQuestion(index: number, fallback?: QuizQuestion, revealed?: QuizAnswerResponse): QuizQuestion | undefined {
    const existing = this.map.get(index);
    if (existing && (!fallback || existing.questionId === fallback.id)) {
      this.map.delete(index);
      if (revealed && existing.revealed !== revealed) {
        const mergedReveal = { ...existing.prefetchedReveal, ...existing.revealed, ...revealed };
        existing.revealed = mergedReveal;
        existing.merged = mergeQuestionWithReveal(existing.question, mergedReveal);
      }
      this.map.set(index, existing);
      return existing.merged ?? existing.question;
    }
    if (!fallback || fallback.sessionPlaceholder) return undefined;
    this.setQuestion(index, fallback);
    if (revealed) {
      return this.setAnswerResult(index, fallback.id, revealed, fallback);
    }
    return this.map.get(index)?.merged ?? fallback;
  }

  /**
   * Reads a cached question without mutating LRU order (for rendering question lists/palettes).
   */
  peekMergedQuestion(index: number, fallback: QuizQuestion, revealed?: QuizAnswerResponse): QuizQuestion {
    if (!fallback || fallback.sessionPlaceholder) return fallback;
    const existing = this.map.get(index);
    if (existing && existing.questionId === fallback.id) {
      if (revealed && existing.revealed !== revealed) {
        return mergeQuestionWithReveal(existing.question, { ...existing.prefetchedReveal, ...existing.revealed, ...revealed });
      }
      return existing.merged ?? existing.question;
    }
    return revealed ? mergeQuestionWithReveal(fallback, revealed) : fallback;
  }

  getAnswerResult(index: number, questionId?: string | number): QuizAnswerResponse | undefined {
    const existing = this.map.get(index);
    if (!existing) return undefined;
    if (questionId !== undefined && existing.questionId !== questionId) return undefined;
    this.map.delete(index);
    this.map.set(index, existing);
    return existing.revealed;
  }

  clear(): void {
    this.map.clear();
    this.pinnedIndices.clear();
  }

  private evictIfNeeded(incomingIndex: number): void {
    if (this.map.size < this.capacity || this.map.has(incomingIndex)) return;
    // First pass: evict the oldest unpinned entry.
    for (const key of this.map.keys()) {
      if (!this.pinnedIndices.has(key)) {
        this.map.delete(key);
        return;
      }
    }
    // Fallback if all entries are pinned: evict the oldest entry.
    const oldestKey = this.map.keys().next().value;
    if (oldestKey !== undefined) {
      this.map.delete(oldestKey);
    }
  }
}
