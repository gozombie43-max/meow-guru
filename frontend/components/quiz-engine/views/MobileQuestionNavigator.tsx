import { getQuestionStatus } from "@/components/quiz-engine/utils";
import { X } from "lucide-react";
import type { QuizController } from "../hooks/useQuizController";

type Props = Pick<
  QuizController,
  | "activeRailBtnRef"
  | "closePalette"
  | "currentIndex"
  | "goToQuestion"
  | "isPaletteOpen"
  | "questions"
  | "selectedAnswers"
  | "submittedQuestions"
> & {
  hideQuestionNumbers: boolean;
};

function statusClass(status: ReturnType<typeof getQuestionStatus>) {
  return `${status === "current" ? "is-current" : ""} ${status === "correct" ? "is-correct" : ""} ${status === "wrong" ? "is-wrong" : ""} ${status === "answered" ? "is-unsubmitted" : ""}`;
}

export function MobileQuestionNavigator({ activeRailBtnRef, closePalette, currentIndex, goToQuestion, hideQuestionNumbers, isPaletteOpen, questions, selectedAnswers, submittedQuestions }: Props) {
  const getStatus = (index: number) => getQuestionStatus({
    index,
    currentIndex,
    selectedAnswers,
    questions,
    submittedQuestions,
  });

  return (
    <>
      {!hideQuestionNumbers && (
        <nav className="ios-series-rail" aria-label="Question navigation">
          {questions.map((question, index) => {
            const status = getStatus(index);
            const statusLabel = status === "wrong" ? "incorrect" : status === "not-answered" ? "unvisited" : status;
            return (
              <button data-ui-button="state"
                key={`rail-${question.id}-${index}`}
                type="button"
                ref={index === currentIndex ? activeRailBtnRef : null}
                onClick={() => goToQuestion(index + 1)}
                className={`ios-series-question ${statusClass(status)}`}
                aria-label={`Question ${index + 1}, ${statusLabel}`}
                aria-current={index === currentIndex ? "step" : undefined}
              >
                {index + 1}
              </button>
            );
          })}
        </nav>
      )}

      {isPaletteOpen && (
        <div className="ios-series-palette" role="dialog" aria-modal="true" aria-label="Question navigator">
          <button type="button" className="ios-series-palette-backdrop" onClick={closePalette} aria-label="Close navigator" />
          <div className="ios-series-palette-panel">
            <div className="ios-series-palette-title">
              <span>Questions</span>
              <button data-ui-button="state" data-ui-shape="icon" type="button" onClick={closePalette} aria-label="Close question navigator"><X /></button>
            </div>
            <div className="ios-series-palette-grid">
              {questions.map((question, index) => (
                <button data-ui-button="state"
                  key={`palette-${question.id}-${index}`}
                  type="button"
                  className={statusClass(getStatus(index))}
                  onClick={() => {
                    goToQuestion(index + 1);
                    closePalette();
                  }}
                  aria-label={`Go to question ${index + 1}`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
