import type { QuizAnswerCommand, RecentQuizPayload } from '@/lib/userApi';
import type { SessionResult } from './types';
import { saveRecentQuiz, submitQuizAnswer } from '@/lib/userApi';
import { notifyRecentQuizUpdated } from '@/lib/recent-study';
import { createCoalescedSave } from '@/lib/coalesced-save';
import { AUTH_TOKEN_CHANGED_EVENT, getAccessToken } from '@/lib/axios';
import { authSessionIdentity } from '@/lib/auth-session-identity';

export interface QuizAnswerResponse {
  correct?: number;
  isCorrect?: boolean;
  solution?: string;
  solutionImage?: string;
  solutionImageWidth?: number;
  solutionImageHeight?: number;
  translations?: {
    bn?: { question?: string; options?: string[]; solution?: string };
    hi?: { question?: string; options?: string[]; solution?: string };
  };
}

type SessionRef = {
  identity: string | null;
  controller: AbortController;
  retryPending: () => void;
};

const sessions = new Set<WeakRef<SessionRef>>();
if (typeof window !== 'undefined') {
  window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, event => {
    const next = authSessionIdentity((event as CustomEvent<string | null>).detail);
    for (const ref of sessions) {
      const session = ref.deref();
      if (!session) sessions.delete(ref);
      else if (next !== session.identity) { session.controller.abort(); sessions.delete(ref); }
    }
  });
  window.addEventListener('online', () => {
    for (const ref of sessions) {
      const session = ref.deref();
      if (!session) sessions.delete(ref);
      else session.retryPending();
    }
  });
}

const sameResult = (a: unknown, b: unknown) => a === b || JSON.stringify(a) === JSON.stringify(b);
function snapshotsEqual(a: RecentQuizPayload, b: RecentQuizPayload) {
  const answers = a.selectedAnswers ?? {}, otherAnswers = b.selectedAnswers ?? {};
  return a.currentIndex === b.currentIndex
    && (answers === otherAnswers || (Object.keys(answers).length === Object.keys(otherAnswers).length
      && Object.entries(answers).every(([index, value]) => otherAnswers[Number(index)] === value)))
    && a.results?.length === b.results?.length
    && (a.results ?? []).every((row, index) => sameResult(row, b.results?.[index]))
    && a.status === b.status && a.questionAnchor === b.questionAnchor
    && a.totalQuestions === b.totalQuestions && a.title === b.title && a.href === b.href
    && a.sessionFilters?.exam === b.sessionFilters?.exam
    && a.sessionFilters?.concept === b.sessionFilters?.concept
    && a.sessionFilters?.letter === b.sessionFilters?.letter
    && a.submittedQuestions?.length === b.submittedQuestions?.length
    && (a.submittedQuestions ?? []).every((index, i) => index === b.submittedQuestions?.[i]);
}

function reconcileRevealedSnapshot(
  saved: RecentQuizPayload | undefined,
  next: RecentQuizPayload,
): RecentQuizPayload {
  if (!saved || !Array.isArray(saved.results) || !Array.isArray(next.results)) {
    return next;
  }
  const savedByIndex = new Map<number, SessionResult>();
  for (const row of saved.results as SessionResult[]) {
    if (typeof row?.correct === 'number' && row.correct >= 0) {
      savedByIndex.set(row.questionIndex, row);
    }
  }
  if (savedByIndex.size === 0) return next;

  let changed = false;
  const mergedResults = (next.results as SessionResult[]).map((row) => {
    const revealed = savedByIndex.get(row.questionIndex);
    if (
      revealed
      && (typeof row.correct !== 'number' || row.correct < 0)
      && row.selected === revealed.selected
    ) {
      changed = true;
      return { ...row, correct: revealed.correct, isCorrect: revealed.isCorrect };
    }
    return row;
  });

  return changed ? { ...next, results: mergedResults } : next;
}

const ANSWER_RETRY_BACKOFF_MS = [2_000, 5_000, 15_000] as const;

export function createResumeSaver(identity: string | null, sessionKey: string) {
  let saved: RecentQuizPayload | undefined, generation = 0, tail = Promise.resolve();
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;
  let disposed = false;
  const clearRetryTimer = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };
  const pending: Array<{
    base: Omit<QuizAnswerCommand, 'resume'>;
    snapshot: RecentQuizPayload;
    command?: QuizAnswerCommand;
    onResolved?: (data?: QuizAnswerResponse) => void;
    onRejected?: () => void;
  }> = [];
  const serialize = (work: () => Promise<void>) => {
    const next = tail.catch(() => {}).then(work);
    tail = next;
    return next;
  };
  const scheduleBackoffRetry = () => {
    if (disposed || retryTimer !== null || !pending.length || session.controller.signal.aborted) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    if (retryAttempt >= ANSWER_RETRY_BACKOFF_MS.length) return;
    const delay = ANSWER_RETRY_BACKOFF_MS[retryAttempt++];
    retryTimer = setTimeout(() => {
      retryTimer = null;
      if (disposed || !pending.length || session.controller.signal.aborted) return;
      if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
      void serialize(drainAnswers).catch(() => {});
    }, delay);
  };
  const drainAnswers = async () => {
    while (pending.length) {
      const entry = pending[0];
      const baseSnapshot = reconcileRevealedSnapshot(saved, entry.snapshot);
      // Freeze the payload as well as the key across uncertain response retries.
      entry.command ??= { ...entry.base, resume: quizSnapshotDelta(saved, baseSnapshot) };
      if (session.controller.signal.aborted) throw new DOMException('Session changed', 'AbortError');
      let res;
      try {
        res = await submitQuizAnswer(entry.command, session.controller.signal);
      } catch (error) {
        // A definitive rejection can never succeed; drop it so later answers still sync.
        const status = (error as { response?: { status?: number } })?.response?.status ?? 0;
        if ([400, 404, 409, 422].includes(status)) {
          pending.shift();
          retryAttempt = 0;
          clearRetryTimer();
          entry.onRejected?.();
          continue;
        }
        const errObj = error && typeof error === 'object' ? (error as { name?: unknown; code?: unknown; kind?: unknown }) : null;
        const isAbort = Boolean(
          errObj && (errObj.name === 'AbortError' || errObj.name === 'CanceledError' || errObj.code === 'ERR_CANCELED' || errObj.kind === 'aborted'),
        );
        if (!isAbort) scheduleBackoffRetry();
        throw error;
      }
      const revealed = res?.data as QuizAnswerResponse | undefined;
      const correctIndex = revealed?.correct;
      saved = typeof correctIndex === 'number' && correctIndex >= 0 && Array.isArray(baseSnapshot.results)
        ? {
            ...baseSnapshot,
            results: (baseSnapshot.results as SessionResult[]).map(row =>
              row.questionIndex === entry.base.questionIndex
                ? { ...row, correct: correctIndex, isCorrect: row.selected === correctIndex }
                : row,
            ),
          }
        : baseSnapshot;
      pending.shift();
      retryAttempt = 0;
      clearRetryTimer();
      entry.onResolved?.(revealed);
    }
  };
  const session: SessionRef = {
    identity,
    controller: new AbortController(),
    retryPending: () => {
      if (disposed) return;
      retryAttempt = 0;
      clearRetryTimer();
      if (pending.length && !session.controller.signal.aborted) {
        void serialize(drainAnswers).catch(() => {});
      }
    },
  };
  session.controller.signal.addEventListener('abort', clearRetryTimer, { once: true });
  for (const ref of sessions) if (!ref.deref()) sessions.delete(ref);
  sessions.add(new WeakRef(session));
  const saver = createCoalescedSave<{ snapshot: RecentQuizPayload; generation: number }>(next => serialize(async () => {
    if (session.controller.signal.aborted) throw new DOMException('Session changed', 'AbortError');
    if (next.generation < generation) return;
    await drainAnswers();
    if (next.generation < generation) return;
    const effective = reconcileRevealedSnapshot(saved, next.snapshot);
    if (saved && snapshotsEqual(saved, effective)) return;
    await saveRecentQuiz(getAccessToken() ?? '', quizSnapshotDelta(saved, effective), session.controller.signal);
    saved = effective;
  }), (a, b) => a.generation === b.generation && snapshotsEqual(a.snapshot, b.snapshot));
  return {
    key: sessionKey,
    save(snapshot: RecentQuizPayload) {
      notifyRecentQuizUpdated?.(snapshot);
      return saver.save({ snapshot, generation });
    },
    retryPending() {
      retryAttempt = 0;
      clearRetryTimer();
      if (!pending.length) return Promise.resolve();
      return serialize(drainAnswers);
    },
    dispose() {
      disposed = true;
      clearRetryTimer();
    },
    answer(base: Omit<QuizAnswerCommand, 'resume'>, snapshot: RecentQuizPayload,
      callbacks: { onResolved?: (data?: QuizAnswerResponse) => void; onRejected?: () => void } = {}): Promise<QuizAnswerResponse | undefined> {
      notifyRecentQuizUpdated?.(snapshot);
      generation++;
      retryAttempt = 0;
      clearRetryTimer();
      let latestResponse: QuizAnswerResponse | undefined;
      pending.push({
        base,
        snapshot,
        // Fires whenever this entry finally commits, even if a later save or reconnect retried it.
        onResolved: (data) => {
          latestResponse = data;
          callbacks.onResolved?.(data);
        },
        onRejected: callbacks.onRejected,
      });
      return serialize(drainAnswers).then(() => latestResponse);
    },
  };
}

export function quizSnapshotDelta(previous: RecentQuizPayload | undefined, next: RecentQuizPayload): RecentQuizPayload {
  if (!previous || (next.results?.length ?? 0) < (previous.results?.length ?? 0)
    || (next.submittedQuestions?.length ?? 0) < (previous.submittedQuestions?.length ?? 0)) {
    if (Object.keys(next.selectedAnswers ?? {}).length <= 500
      && (next.results?.length ?? 0) <= 500 && (next.submittedQuestions?.length ?? 0) <= 500) return next;
    // Restoring a long session must not prevent the next answer from committing.
    // Send a bounded delta and preserve the older server history already saved.
    return { ...next, delta: true, selectedAnswers: Object.fromEntries(Object.entries(next.selectedAnswers ?? {}).slice(-500)),
      submittedQuestions: next.submittedQuestions?.slice(-500), results: next.results?.slice(-500) };
  }
  const oldResults = new Map((previous.results as SessionResult[] ?? []).map(result => [result.questionIndex, result]));
  return { ...next, delta: true,
    selectedAnswers: Object.fromEntries(Object.entries(next.selectedAnswers ?? {}).filter(([key, value]) => previous.selectedAnswers?.[Number(key)] !== value)),
    removedAnswers: Object.keys(previous.selectedAnswers ?? {}).map(Number).filter(key => !(key in (next.selectedAnswers ?? {}))),
    submittedQuestions: (next.submittedQuestions ?? []).filter(index => !previous.submittedQuestions?.includes(index)),
    results: (next.results as SessionResult[] ?? []).filter(result => !sameResult(oldResults.get(result.questionIndex), result)),
  };
}
