import { useCallback, useRef, useEffect } from "react";
import { QuizTimerRef } from "@/components/quiz-engine/QuizTimer";

export function useQuizTimer() {
  const timerRef = useRef<QuizTimerRef>(null);
  const maxTime = 60;

  const stopTimer = useCallback(() => {
    timerRef.current?.stop();
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current?.start(maxTime);
  }, [maxTime]);

  useEffect(() => () => stopTimer(), [stopTimer]);

  return { timerRef, maxTime, startTimer, stopTimer };
}
