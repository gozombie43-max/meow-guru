import { useEffect } from "react";
import type { QuizQuestion } from "@/components/quiz-engine/types";

export function useQuizKeyboard({
  enabled,
  currentIndex,
  currentQ,
  selectedAnswer,
  handleSelectAnswer,
  showQuestion,
}: {
  enabled: boolean;
  currentIndex: number;
  currentQ: QuizQuestion | undefined;
  selectedAnswer: number | null;
  handleSelectAnswer: (index: number) => void;
  showQuestion: (index: number) => void;
}): void {
  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        showQuestion(currentIndex - 1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        showQuestion(currentIndex + 1);
        return;
      }
      if (!currentQ) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const base =
          selectedAnswer === null
            ? 0
            : Math.min(selectedAnswer + 1, currentQ.options.length - 1);
        handleSelectAnswer(base);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const base =
          selectedAnswer === null
            ? currentQ.options.length - 1
            : Math.max(selectedAnswer - 1, 0);
        handleSelectAnswer(base);
        return;
      }
      const num = Number.parseInt(event.key, 10);
      if (num >= 1 && num <= currentQ.options.length) {
        event.preventDefault();
        handleSelectAnswer(num - 1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    currentIndex,
    currentQ,
    enabled,
    handleSelectAnswer,
    selectedAnswer,
    showQuestion,
  ]);
}
