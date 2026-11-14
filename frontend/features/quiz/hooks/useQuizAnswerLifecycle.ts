"use client";
import type { useQuizTimer } from "@/features/quiz/hooks/useQuizTimer";
import type { QuizQuestion } from "@/features/quiz/model/types";
import type { QuizAnswerCommand, RecentQuizPayload } from "@/lib/userApi";
import type { QuizAnswerResponse } from "../model/resumeDelta";
import { mergeQuestionWithReveal } from "../model/quizLruCache";
import { ANSWER_RETRY_PREFIX, quizSessionReducer } from '../model/sessionReducer';
import { invalidateTopicProgressCache } from "@/hooks/useTopicQuestionTotals";
import { useCallback, useRef, type Dispatch } from "react";
import type { QuizSessionState, QuizEvent } from "../model/sessionReducer";

export function useQuizAnswerLifecycle({
  currentQ,
  token,
  timer,
  state,
  dispatch,
  persistAnswer,
  snapshot,
  getPrefetchedReveal,
  onAnswerSubmitted,
  onAnswerRevealed,
}: {
  currentQ: QuizQuestion | undefined;
  token: string | null;
  timer: ReturnType<typeof useQuizTimer>;
  state: QuizSessionState;
  dispatch: Dispatch<QuizEvent>;
  persistAnswer: (
    command: Omit<QuizAnswerCommand, 'resume'>,
    snapshot: RecentQuizPayload,
    callbacks?: { onResolved?: (data?: QuizAnswerResponse) => void; onRejected?: () => void },
  ) => Promise<QuizAnswerResponse | undefined>;
  snapshot: (state: QuizSessionState) => RecentQuizPayload;
  getPrefetchedReveal?: (index: number, questionId?: string | number) => QuizAnswerResponse | undefined;
  onAnswerSubmitted?: () => void;
  onAnswerRevealed?: (index: number, questionId: string | number, revealed: QuizAnswerResponse) => void;
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
    const index = currentIndex;
    const questionId = currentQ.id;
    const generation = state.sessionGeneration ?? 0;
    submitting.current.add(index);
    stopTimer();
    const timeTaken = Math.max(1, timerRef.current?.getElapsed ? timerRef.current.getElapsed() : maxTime - (timerRef.current?.getTimeLeft() ?? 0));

    // Check if the answer key for this question was already prefetched into the LRU cache.
    const prefetched = getPrefetchedReveal?.(index, questionId);
    const effectiveQuestion =
      currentQ.correctAnswer < 0 && prefetched && typeof prefetched.correct === 'number' && prefetched.correct >= 0
        ? mergeQuestionWithReveal(currentQ, prefetched)
        : currentQ;

    if (prefetched && typeof prefetched.correct === 'number' && prefetched.correct >= 0) {
      onAnswerRevealed?.(index, questionId, prefetched);
    }

    const event: QuizEvent = { type: 'SUBMIT', question: effectiveQuestion, timeTaken };
    dispatch(event);
    invalidateTopicProgressCache();
    onAnswerSubmitted?.();

    const vibrate = (correct: boolean) => { try { navigator.vibrate?.(correct ? [12, 35, 18] : 20); } catch {} };
    const answerKnown = effectiveQuestion.correctAnswer >= 0;
    if (answerKnown) vibrate(selected === effectiveQuestion.correctAnswer);

    if (token) {
      const submissionId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `quiz_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      void persistAnswer(
        {
          questionId: currentQ.rawId || currentQ.id,
          questionUid: currentQ.questionUid && /^q_[a-f0-9]{32}$/.test(currentQ.questionUid) ? currentQ.questionUid : undefined,
          questionAnchor: currentQ.sessionAnchor && /^[a-f0-9]{24}$/i.test(currentQ.sessionAnchor) ? currentQ.sessionAnchor : undefined,
          topic: currentQ.chapter || undefined,
          answer: selected,
          submissionId,
          questionIndex: index,
          timeTaken,
        },
        snapshot(quizSessionReducer(state, event)),
        {
          onResolved: (revealed) => {
            invalidateTopicProgressCache();
            if (!revealed) return;
            onAnswerRevealed?.(index, questionId, revealed);
            if (!answerKnown && typeof revealed.correct === 'number') {
              vibrate(selected === revealed.correct);
            }
            dispatch({ type: 'REVEAL', index, questionId, generation, revealed });
          },
          onRejected: () => {
            submitting.current.delete(index);
            if (!answerKnown) {
              dispatch({
                type: 'ERROR',
                index,
                generation,
                message: 'This answer could not be checked. Please continue with the next question.',
              });
            }
          },
        },
      ).catch(() => {
        if (!answerKnown) {
          dispatch({
            type: 'ERROR',
            index,
            generation,
            message: `${ANSWER_RETRY_PREFIX}… it will retry automatically when the connection recovers.`,
          });
        }
      });
    } else if (!answerKnown) {
      dispatch({ type: 'ERROR', message: 'Sign in to check your answers and see solutions.' });
    }
  }, [currentQ, state, submittedQuestions, currentIndex, selectedAnswers, stopTimer, timerRef, maxTime, token, dispatch, persistAnswer, snapshot, getPrefetchedReveal, onAnswerSubmitted, onAnswerRevealed]);

  const handleClearResponse = useCallback(() => dispatch({ type: 'CLEAR' }), [dispatch]);
  const resetAnswers = useCallback(() => {
    submitting.current.clear();
    dispatch({ type: 'RESTART' });
  }, [dispatch]);

  return {
    selectedAnswers,
    submittedQuestions,
    selectedAnswer: selectedAnswers[currentIndex] ?? null,
    difficulty: state.difficulty,
    bestStreak: state.bestStreak,
    results: state.results,
    submitError: state.submitError,
    handleSelectAnswer,
    handleSubmitCurrent,
    handleClearResponse,
    resetAnswers,
  };
}
