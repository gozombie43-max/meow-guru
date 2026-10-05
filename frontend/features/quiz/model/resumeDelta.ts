import type { RecentQuizPayload } from '@/lib/userApi';
import type { SessionResult } from './types';
import { saveRecentQuiz } from '@/lib/userApi';
import { createCoalescedSave } from '@/lib/coalesced-save';

export function createResumeSaver(token: string | null, sessionKey: string) {
  const state: { saved?: RecentQuizPayload; key: string } = { key: sessionKey };
  return createCoalescedSave<RecentQuizPayload>(async next => {
    await saveRecentQuiz(token!, quizSnapshotDelta(state.saved, next));
    state.saved = next;
  }, (a, b) => a.currentIndex === b.currentIndex && a.selectedAnswers === b.selectedAnswers
    && a.results === b.results && a.status === b.status && a.questionAnchor === b.questionAnchor
    && a.totalQuestions === b.totalQuestions && a.title === b.title && a.href === b.href
    && a.sessionFilters?.exam === b.sessionFilters?.exam
    && a.sessionFilters?.concept === b.sessionFilters?.concept
    && a.sessionFilters?.letter === b.sessionFilters?.letter
    && a.submittedQuestions?.length === b.submittedQuestions?.length
    && (a.submittedQuestions ?? []).every((index, i) => index === b.submittedQuestions?.[i]));
}

export function quizSnapshotDelta(previous: RecentQuizPayload | undefined, next: RecentQuizPayload): RecentQuizPayload {
  if (!previous || (next.results?.length ?? 0) < (previous.results?.length ?? 0)
    || (next.submittedQuestions?.length ?? 0) < (previous.submittedQuestions?.length ?? 0)) return next;
  const oldResults = new Map((previous.results as SessionResult[] ?? []).map(result => [result.questionIndex, result]));
  return { ...next, delta: true,
    selectedAnswers: Object.fromEntries(Object.entries(next.selectedAnswers ?? {}).filter(([key, value]) => previous.selectedAnswers?.[Number(key)] !== value)),
    removedAnswers: Object.keys(previous.selectedAnswers ?? {}).map(Number).filter(key => !(key in (next.selectedAnswers ?? {}))),
    submittedQuestions: (next.submittedQuestions ?? []).filter(index => !previous.submittedQuestions?.includes(index)),
    results: (next.results as SessionResult[] ?? []).filter(result => oldResults.get(result.questionIndex) !== result),
  };
}
