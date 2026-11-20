import { useEffect, useRef } from "react";
import type { createResumeSaver } from '../model/resumeDelta';
import type { SessionResult, Difficulty, QuizQuestion } from "@/features/quiz/model/types";

export function useQuizSync({
  token,
  started,
  showAnalytics,
  questions,
  quizKey,
  title,
  subjectId,
  slug,
  quizHref,
  mode,
  currentIndex,
  selectedAnswers,
  submittedQuestions,
  results,
  resumeRequested,
  resumeAppliedRef,
  storageKey,
  conceptFilter,
  examFilter,
  selectedClassificationConcepts,
  difficulty,
  sessionFilters,
  saver,
}: {
  token: string | null;
  started: boolean;
  showAnalytics: boolean;
  questions: QuizQuestion[];
  quizKey: string;
  title: string;
  subjectId: string;
  slug: string;
  quizHref: string;
  mode: string;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  submittedQuestions: Set<number>;
  results: SessionResult[];
  resumeRequested: boolean;
  resumeAppliedRef: React.MutableRefObject<boolean>;
  storageKey: string;
  conceptFilter: string | null;
  examFilter: string | null;
  selectedClassificationConcepts: Set<string>;
  difficulty: Difficulty;
  sessionFilters?: { exam?: string; concept?: string; letter?: string };
  saver: ReturnType<typeof createResumeSaver>;
}): void {
  const localFlush = useRef<(() => void) | null>(null);
  const serverFlush = useRef<(() => void) | null>(null);
  const questionsRef = useRef(questions);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  const hasQuestions = questions.length > 0;
  const currentAnchor = questions[currentIndex]?.sessionAnchor;

  useEffect(() => () => { localFlush.current?.(); serverFlush.current?.(); }, []);

  useEffect(() => {
    serverFlush.current = null;
    if (!token || !started || showAnalytics) return;
    if (!hasQuestions) return;
    if (resumeRequested && !resumeAppliedRef.current) return;

    const submittedList = Array.from(submittedQuestions);
    const snapshotPayload = {
      quizKey,
      title,
      subject: subjectId,
      slug,
      href: quizHref,
      mode,
      currentIndex,
      questionAnchor: currentAnchor ?? questionsRef.current[currentIndex]?.sessionAnchor,
      sessionFilters,
      totalQuestions: questionsRef.current.length,
      selectedAnswers,
      submittedQuestions: submittedList,
      results,
      status: "in-progress" as const,
    };
    const save = () => {
      saver.save(snapshotPayload).catch(() => {});
    };
    const saveTimeout = window.setTimeout(save, 600);
    serverFlush.current = save;
    const hidden = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', save);

    return () => { window.clearTimeout(saveTimeout); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', save); };
  }, [
    currentIndex,
    currentAnchor,
    hasQuestions,
    mode,
    quizHref,
    quizKey,
    resumeRequested,
    resumeAppliedRef,
    results,
    selectedAnswers,
    slug,
    started,
    submittedQuestions,
    title,
    token,
    showAnalytics,
    subjectId,
    saver,
    sessionFilters,
  ]);

  useEffect(() => {
    if (!token || !showAnalytics) return;
    if (!hasQuestions) return;

    const submittedList = Array.from(submittedQuestions);
    const save = () => saver.save({
      quizKey,
      title,
      subject: subjectId,
      slug,
      href: quizHref,
      mode,
      currentIndex,
      questionAnchor: currentAnchor ?? questionsRef.current[currentIndex]?.sessionAnchor,
      sessionFilters,
      totalQuestions: questionsRef.current.length,
      selectedAnswers,
      submittedQuestions: submittedList,
      results,
      status: "completed",
    }).catch(() => {});
    serverFlush.current = save;
    void save();
  }, [
    currentIndex,
    currentAnchor,
    hasQuestions,
    mode,
    quizHref,
    quizKey,
    results,
    selectedAnswers,
    slug,
    submittedQuestions,
    title,
    token,
    showAnalytics,
    subjectId,
    saver,
    sessionFilters,
  ]);

  useEffect(() => {
    localFlush.current = null;
    if (typeof window === "undefined" || !started || !hasQuestions)
      return;
    if (submittedQuestions.size === 0) return;

    const stateToSave = {
      selectedAnswers,
      submittedQuestions: Array.from(submittedQuestions),
      results,
      currentIndex,
      mode,
      questionAnchor: currentAnchor ?? questionsRef.current[currentIndex]?.sessionAnchor,
      conceptFilter,
      examFilter,
      selectedClassificationConcepts: Array.from(
        selectedClassificationConcepts,
      ),
      difficulty,
    };
    const persist = () => {
      try { window.localStorage.setItem(storageKey, JSON.stringify(stateToSave)); } catch {}
    };
    localFlush.current = persist;
    const timer = window.setTimeout(persist, 250);
    const hidden = () => { if (document.visibilityState === 'hidden') persist(); };
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', persist);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', persist); };
  }, [
    started,
    hasQuestions,
    currentAnchor,
    selectedAnswers,
    submittedQuestions,
    results,
    currentIndex,
    mode,
    conceptFilter,
    examFilter,
    selectedClassificationConcepts,
    difficulty,
    storageKey,
  ]);
}
