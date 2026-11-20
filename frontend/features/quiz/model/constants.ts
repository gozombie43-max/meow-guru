/**
 * Shared constants and canonical identity helpers for batched question delivery.
 */

export const DEFAULT_QUIZ_BATCH_SIZE = 25;
export const MIN_QUIZ_BATCH_SIZE = 10;
export const MAX_QUIZ_BATCH_SIZE = 100;

/**
 * Number of remaining questions before the end of the currently loaded buffer
 * at which background prefetching triggers (e.g. Q15 of 20 or Q19/20 of 25).
 */
export const DEFAULT_PREFETCH_THRESHOLD = 6;

/**
 * Safety ceiling for cursor-draining library endpoints (e.g. study-mode)
 * to prevent runaway pagination loops.
 */
export const DEFAULT_MAX_STUDY_MODE_PAGES = 50;

export interface QuestionIdentityLike {
  questionUid?: string;
  sessionAnchor?: string;
  rawId?: string | number;
  id?: string | number;
  sessionPlaceholder?: boolean;
}

/**
 * Returns a stable canonical deduplication key prioritizing
 * `questionUid ?? sessionAnchor ?? rawId ?? id`.
 * Returns `null` for unloaded session placeholders or empty entries.
 */
export function canonicalQuestionKey(question: QuestionIdentityLike | null | undefined): string | null {
  if (!question || question.sessionPlaceholder) return null;
  const uid = typeof question.questionUid === 'string' ? question.questionUid.trim() : '';
  if (uid) return `uid:${uid}`;
  const anchor = typeof question.sessionAnchor === 'string' ? question.sessionAnchor.trim() : '';
  if (anchor) return `anchor:${anchor}`;
  const raw =
    question.rawId !== undefined && question.rawId !== null && String(question.rawId).trim() !== ''
      ? String(question.rawId).trim()
      : question.id !== undefined && question.id !== null && String(question.id).trim() !== ''
        ? String(question.id).trim()
        : '';
  return raw ? `id:${raw}` : null;
}

/**
 * Safely computes the 0-based index threshold at which background prefetch should fire.
 */
export function computePrefetchTriggerIndex(loadedCount: number, threshold = DEFAULT_PREFETCH_THRESHOLD): number {
  if (loadedCount <= 0) return 0;
  const safeThreshold = Math.max(1, Math.min(Math.floor(threshold), loadedCount));
  return Math.max(0, loadedCount - safeThreshold);
}
