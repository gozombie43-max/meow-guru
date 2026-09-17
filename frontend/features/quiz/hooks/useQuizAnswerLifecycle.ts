"use client";
import type { useQuizTimer } from "@/components/quiz-engine/hooks/useQuizTimer";
import type { Difficulty,QuizQuestion,SessionResult } from "@/components/quiz-engine/types";
import { updateProgress } from "@/lib/userApi";
import { useCallback,useRef,useState } from "react";
import { nextDifficulty,recordAnswer } from "../model/answerLifecycle";

export function useQuizAnswerLifecycle({ currentIndex, currentQ, token, timer }: {
  currentIndex: number; currentQ: QuizQuestion | undefined; token: string | null;
  timer: ReturnType<typeof useQuizTimer>;
}) {
  const { timerRef, maxTime, stopTimer } = timer;
  const submitting = useRef(new Set<number>());
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<number>>(
    new Set(),
  );
  const selectedAnswer = selectedAnswers[currentIndex] ?? null;
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [submitError, setSubmitError] = useState("");
  const handleSelectAnswer = useCallback(
    (index: number) => {
      if (!currentQ) return;
      if (submittedQuestions.has(currentIndex)) return;
      if (index < 0 || index >= currentQ.options.length) return;
      setSelectedAnswers((prev) => ({ ...prev, [currentIndex]: index }));
      setSubmitError("");
    },
    [currentIndex, currentQ, submittedQuestions],
  );

  const handleSubmitCurrent = useCallback(() => {
    if (!currentQ) return;
    if (submittedQuestions.has(currentIndex) || submitting.current.has(currentIndex)) return;
    const selected = selectedAnswers[currentIndex];
    if (selected === undefined) {
      setSubmitError("Please choose an option before submitting.");
      return;
    }

    submitting.current.add(currentIndex);
    stopTimer();
    const timeTaken = Math.max(
      1,
      timerRef.current?.getElapsed
        ? timerRef.current.getElapsed()
        : maxTime - (timerRef.current?.getTimeLeft() ?? 0),
    );
    const isCorrect = selected === currentQ.correctAnswer;
    setDifficulty(nextDifficulty(results, difficulty, isCorrect));

    try {
      navigator.vibrate?.(isCorrect ? [12, 35, 18] : 20);
    } catch {}

    const nextStreak = isCorrect ? streak + 1 : 0;
    setStreak(nextStreak);
    setBestStreak(Math.max(bestStreak, nextStreak));

    if (token) {
      updateProgress(token, currentQ.concept, 1, isCorrect ? 1 : 0).catch(
        () => {},
      );
    }

    setResults(prev => recordAnswer(prev, currentQ, currentIndex, selected, timeTaken));

    setSubmittedQuestions((prev) => {
      const next = new Set(prev);
      next.add(currentIndex);
      return next;
    });

    setSubmitError("");
  }, [
    results, difficulty, streak, bestStreak,
    currentIndex,
    currentQ,
    maxTime,
    selectedAnswers,
    stopTimer,
    submittedQuestions,
    token,
    timerRef,
  ]);

  const handleClearResponse = useCallback(() => {
    if (submittedQuestions.has(currentIndex)) return;
    setSelectedAnswers((prev) => {
      if (!(currentIndex in prev)) return prev;
      const next = { ...prev };
      delete next[currentIndex];
      return next;
    });
    setSubmitError("");
  }, [currentIndex, submittedQuestions]);


  function resetAnswers() {
    submitting.current.clear();
    setResults([]); setSelectedAnswers({});
    setSubmittedQuestions(new Set()); setStreak(0); setBestStreak(0); setSubmitError("");
  }
  return { selectedAnswers, setSelectedAnswers, submittedQuestions, setSubmittedQuestions,
    selectedAnswer, difficulty, setDifficulty, bestStreak, results, setResults,
    submitError, setSubmitError, handleSelectAnswer, handleSubmitCurrent, handleClearResponse, resetAnswers };
}
