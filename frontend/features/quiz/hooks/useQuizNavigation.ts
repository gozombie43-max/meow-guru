"use client";
import type { useQuizTimer } from "@/components/quiz-engine/hooks/useQuizTimer";
import type { QuizQuestion } from "@/components/quiz-engine/types";
import { useCallback,type Dispatch,type SetStateAction } from "react";
import type { useQuizAnswerLifecycle } from "./useQuizAnswerLifecycle";

export function useQuizNavigation({ questions, currentIndex, setCurrentIndex, started, showAnalytics,
  setShowAnalytics, setIsSolutionOpen, hasMore, fetchMore, refreshUser, answers, timer }: {
  questions: QuizQuestion[]; currentIndex: number; setCurrentIndex: Dispatch<SetStateAction<number>>;
  started: boolean; showAnalytics: boolean; setShowAnalytics: Dispatch<SetStateAction<boolean>>;
  setIsSolutionOpen: Dispatch<SetStateAction<boolean>>; hasMore: boolean;
  fetchMore: () => void; refreshUser: () => void;
  answers: ReturnType<typeof useQuizAnswerLifecycle>; timer: ReturnType<typeof useQuizTimer>;
}) {
  const { submittedQuestions, setSubmitError } = answers;
  const { startTimer, stopTimer } = timer;
  const showQuestion = useCallback(
    (index: number) => {
      if (questions.length === 0) return;
      const safeIndex = Math.max(0, Math.min(index, questions.length - 1));
      stopTimer();
      setCurrentIndex(safeIndex);
      setSubmitError("");
      setIsSolutionOpen(false);
      if (started && !showAnalytics && !submittedQuestions.has(safeIndex)) {
        startTimer();
      }
    },
    [
      questions,
      showAnalytics,
      startTimer,
      started,
      stopTimer,
      submittedQuestions,
      setCurrentIndex, setIsSolutionOpen, setSubmitError,
    ],
  );

  const goToQuestion = useCallback(
    (questionNumber: number) => {
      if (questions.length === 0) return;
      const safeNumber = Math.max(
        1,
        Math.min(questionNumber, questions.length),
      );
      showQuestion(safeNumber - 1);
    },
    [questions.length, showQuestion],
  );

  const handlePrev = useCallback(() => {
    if (currentIndex <= 0) return;
    showQuestion(currentIndex - 1);
  }, [currentIndex, showQuestion]);

  function handleNext() {
    if (currentIndex < questions.length - 1) {
      showQuestion(currentIndex + 1);
    } else if (hasMore) {
      void fetchMore();
      setSubmitError(
        "Loading the next questions. Please try Next again shortly.",
      );
    } else {
      stopTimer();
      refreshUser();
      setIsSolutionOpen(false);
      setShowAnalytics(true);
    }
  }

  return { showQuestion, goToQuestion, handlePrev, handleNext };
}
