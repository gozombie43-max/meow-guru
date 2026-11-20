import { useCallback, useRef, useEffect } from "react";
import { QuizTimerRef } from "@/features/quiz/components/QuizTimer";

export function useQuizTimer() {
  const timerRef = useRef<QuizTimerRef>(null);
  const startedAtRef = useRef<number | null>(null);
  const stoppedElapsedRef = useRef<number | null>(null);
  const maxTime = 60;

  const stopTimer = useCallback(() => {
    if (stoppedElapsedRef.current === null && startedAtRef.current !== null) {
      stoppedElapsedRef.current = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
    }
    timerRef.current?.stop();
  }, []);

  const startTimer = useCallback(() => {
    startedAtRef.current = Date.now();
    stoppedElapsedRef.current = null;
    timerRef.current?.start(maxTime);
  }, [maxTime]);

  const getElapsed = useCallback(() => {
    if (timerRef.current?.getElapsed) return timerRef.current.getElapsed();
    if (timerRef.current?.getTimeLeft) return Math.max(1, maxTime - timerRef.current.getTimeLeft());
    if (stoppedElapsedRef.current !== null) return stoppedElapsedRef.current;
    return startedAtRef.current !== null ? Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)) : 1;
  }, [maxTime]);

  useEffect(() => {
    if (startedAtRef.current === null) startedAtRef.current = Date.now();
    return () => stopTimer();
  }, [stopTimer]);

  return { timerRef, maxTime, startTimer, stopTimer, getElapsed };
}
