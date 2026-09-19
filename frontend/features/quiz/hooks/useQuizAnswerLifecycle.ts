"use client";
import type { useQuizTimer } from "@/features/quiz/hooks/useQuizTimer";
import type { QuizQuestion } from "@/features/quiz/model/types";
import { updateProgress } from "@/lib/userApi";
import { useCallback, useRef, type Dispatch } from "react";
import type { QuizSessionState, QuizEvent } from "../model/sessionReducer";

export function useQuizAnswerLifecycle({ currentQ, token, timer, state, dispatch }: {
  currentQ: QuizQuestion | undefined; token: string | null;
  timer: ReturnType<typeof useQuizTimer>; state: QuizSessionState; dispatch: Dispatch<QuizEvent>;
}) {
  const { currentIndex, selectedAnswers, submittedQuestions } = state;
  const { timerRef, maxTime, stopTimer } = timer;
  const submitting = useRef(new Set<number>());
  const handleSelectAnswer = useCallback((answer: number) => {
    if (currentQ) dispatch({ type: 'SELECT', answer, optionCount: currentQ.options.length });
  }, [currentQ, dispatch]);
  const handleSubmitCurrent = useCallback(() => {
    if (!currentQ || state.phase === 'completed' || submittedQuestions.has(currentIndex) || submitting.current.has(currentIndex)) return;
    const selected = selectedAnswers[currentIndex];
    if (selected === undefined) {
      dispatch({ type: 'ERROR', message: 'Please choose an option before submitting.' });
      return;
    }
    submitting.current.add(currentIndex);
    stopTimer();
    const timeTaken = Math.max(1, timerRef.current?.getElapsed ? timerRef.current.getElapsed() : maxTime - (timerRef.current?.getTimeLeft() ?? 0));
    dispatch({ type: 'SUBMIT', question: currentQ, timeTaken });
    const correct = selected === currentQ.correctAnswer;
    try { navigator.vibrate?.(correct ? [12, 35, 18] : 20); } catch {}
    if (token) void updateProgress(token, currentQ.concept, 1, correct ? 1 : 0).catch(() => {});
  }, [currentQ, state.phase, submittedQuestions, currentIndex, selectedAnswers, stopTimer, timerRef, maxTime, token, dispatch]);
  const handleClearResponse = useCallback(() => dispatch({ type: 'CLEAR' }), [dispatch]);
  const resetAnswers = useCallback(() => { submitting.current.clear(); dispatch({ type: 'RESTART' }); }, [dispatch]);
  return { selectedAnswers, submittedQuestions, selectedAnswer: selectedAnswers[currentIndex] ?? null,
    difficulty: state.difficulty, bestStreak: state.bestStreak, results: state.results, submitError: state.submitError,
    handleSelectAnswer, handleSubmitCurrent, handleClearResponse, resetAnswers };
}
