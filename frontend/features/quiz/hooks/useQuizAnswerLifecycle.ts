"use client";
import type { useQuizTimer } from "@/features/quiz/hooks/useQuizTimer";
import type { QuizQuestion } from "@/features/quiz/model/types";
import type { QuizAnswerCommand, RecentQuizPayload } from "@/lib/userApi";
import { quizSessionReducer } from '../model/sessionReducer';
import { useCallback, useRef, type Dispatch } from "react";
import type { QuizSessionState, QuizEvent } from "../model/sessionReducer";

export function useQuizAnswerLifecycle({ currentQ, token, timer, state, dispatch, persistAnswer, snapshot }: {
  currentQ: QuizQuestion | undefined; token: string | null;
  timer: ReturnType<typeof useQuizTimer>; state: QuizSessionState; dispatch: Dispatch<QuizEvent>;
  persistAnswer: (command: Omit<QuizAnswerCommand, 'resume'>, snapshot: RecentQuizPayload) => Promise<void>;
  snapshot: (state: QuizSessionState) => RecentQuizPayload;
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
    const event: QuizEvent = { type: 'SUBMIT', question: currentQ, timeTaken };
    dispatch(event);
    const correct = selected === currentQ.correctAnswer;
    try { navigator.vibrate?.(correct ? [12, 35, 18] : 20); } catch {}
    if (token) {
      const submissionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `quiz_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      void persistAnswer({ questionId: currentQ.id, questionUid: currentQ.questionUid,
        questionAnchor: currentQ.sessionAnchor && /^[a-f0-9]{24}$/i.test(currentQ.sessionAnchor) ? currentQ.sessionAnchor : undefined,
        answer: selected, submissionId, questionIndex: currentIndex, timeTaken },
      snapshot(quizSessionReducer(state, event))).catch(() => {
        dispatch({ type: 'ERROR', message: 'Could not sync this answer yet. Your next save will retry.' });
      });
    }
  }, [currentQ, state, submittedQuestions, currentIndex, selectedAnswers, stopTimer, timerRef, maxTime, token, dispatch, persistAnswer, snapshot]);
  const handleClearResponse = useCallback(() => dispatch({ type: 'CLEAR' }), [dispatch]);
  const resetAnswers = useCallback(() => { submitting.current.clear(); dispatch({ type: 'RESTART' }); }, [dispatch]);
  return { selectedAnswers, submittedQuestions, selectedAnswer: selectedAnswers[currentIndex] ?? null,
    difficulty: state.difficulty, bestStreak: state.bestStreak, results: state.results, submitError: state.submitError,
    handleSelectAnswer, handleSubmitCurrent, handleClearResponse, resetAnswers };
}
