import { useEffect } from "react";
import { saveRecentQuiz } from "@/lib/userApi";
import type { SessionResult, Difficulty, QuizQuestion } from "@/components/quiz-engine/types";

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
}): void {
  useEffect(() => {
    if (!token || !started || showAnalytics) return;
    if (questions.length === 0) return;
    if (resumeRequested && !resumeAppliedRef.current) return;

    const submittedList = Array.from(submittedQuestions);
    const saveTimeout = window.setTimeout(() => {
      saveRecentQuiz(token, {
        quizKey,
        title,
        subject: subjectId,
        slug,
        href: quizHref,
        mode,
        currentIndex,
        totalQuestions: questions.length,
        selectedAnswers,
        submittedQuestions: submittedList,
        results,
        status: "in-progress",
      }).catch(() => {});
    }, 600);

    return () => window.clearTimeout(saveTimeout);
  }, [
    currentIndex,
    mode,
    questions.length,
    quizHref,
    quizKey,
    resumeRequested,
    results,
    selectedAnswers,
    slug,
    started,
    submittedQuestions,
    title,
    token,
    showAnalytics,
    subjectId,
  ]);

  useEffect(() => {
    if (!token || !showAnalytics) return;
    if (questions.length === 0) return;

    const submittedList = Array.from(submittedQuestions);
    saveRecentQuiz(token, {
      quizKey,
      title,
      subject: subjectId,
      slug,
      href: quizHref,
      mode,
      currentIndex,
      totalQuestions: questions.length,
      selectedAnswers,
      submittedQuestions: submittedList,
      results,
      status: "completed",
    }).catch(() => {});
  }, [
    currentIndex,
    mode,
    questions.length,
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
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || !started || questions.length === 0)
      return;
    if (submittedQuestions.size === 0) return;

    const stateToSave = {
      selectedAnswers,
      submittedQuestions: Array.from(submittedQuestions),
      currentIndex,
      mode,
      conceptFilter,
      examFilter,
      selectedClassificationConcepts: Array.from(
        selectedClassificationConcepts,
      ),
      difficulty,
    };
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch {}
  }, [
    started,
    questions.length,
    selectedAnswers,
    submittedQuestions,
    currentIndex,
    mode,
    conceptFilter,
    examFilter,
    selectedClassificationConcepts,
    difficulty,
    storageKey,
  ]);
}
