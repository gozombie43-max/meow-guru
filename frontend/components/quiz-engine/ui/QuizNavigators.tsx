import React, { useRef, useEffect } from 'react';
import { QuizQuestion } from '../types';
import { getQuestionStatus, statusClasses } from '../utils';
import { QuestionPaletteModal } from './QuestionPalette';

export function QuestionNavigator({
  total,
  currentIndex,
  selectedAnswers,
  questions,
  submittedQuestions,
  onGoToQuestion,
  onOpenPalette,
  onClosePalette,
  isPaletteOpen,
}: {
  total: number;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  questions: QuizQuestion[];
  submittedQuestions: Set<number>;
  onGoToQuestion: (questionNumber: number) => void;
  onOpenPalette?: () => void;
  onClosePalette: () => void;
  isPaletteOpen: boolean;
}) {
  const quickButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeButton = quickButtonRefs.current[currentIndex];
    if (!activeButton) return;
    activeButton.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentIndex]);

  return (
    <>
      <div
        className="rounded-2xl border p-2 shadow-[0_10px_24px_rgba(15,23,42,0.1)] backdrop-blur"
        style={{ background: "var(--quiz-nav-bg)", borderColor: "var(--quiz-nav-border)" }}
      >
        <div
          className="rounded-xl border px-1 py-1.5"
          style={{ background: "var(--quiz-nav-inner-bg)", borderColor: "var(--quiz-nav-border)" }}
        >
          <div
            className="question-strip qnav-bar-scroll mx-auto"
            style={{ scrollSnapType: "x mandatory" }}
          >
            {Array.from({ length: total }, (_, index) => {
              const status = getQuestionStatus({
                index,
                currentIndex,
                selectedAnswers,
                questions,
                submittedQuestions,
              });
              return (
                <button
                  key={index}
                  ref={(el) => {
                    quickButtonRefs.current[index] = el;
                  }}
                  onClick={() => onGoToQuestion(index + 1)}
                  className={`qnum-chip h-11 w-11 min-h-11 min-w-11 rounded-lg text-sm font-semibold ${statusClasses(status)}`}
                  aria-label={`Question ${index + 1}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <QuestionPaletteModal
        isOpen={isPaletteOpen}
        total={total}
        currentIndex={currentIndex}
        selectedAnswers={selectedAnswers}
        questions={questions}
        submittedQuestions={submittedQuestions}
        onClose={onClosePalette}
        onGoToQuestion={onGoToQuestion}
      />
    </>
  );
}

export function QuestionQuickBar({
  total,
  currentIndex,
  selectedAnswers,
  questions,
  submittedQuestions,
  onGoToQuestion,
}: {
  total: number;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  questions: QuizQuestion[];
  submittedQuestions: Set<number>;
  onGoToQuestion: (questionNumber: number) => void;
}) {
  const quickButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    const activeButton = quickButtonRefs.current[currentIndex];
    if (!activeButton) return;
    activeButton.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [currentIndex]);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="question-strip qnav-bar-scroll" style={{ scrollSnapType: "x mandatory" }}>
        {Array.from({ length: total }, (_, index) => {
          const status = getQuestionStatus({
            index,
            currentIndex,
            selectedAnswers,
            questions,
            submittedQuestions,
          });
          return (
            <button
              key={index}
              ref={(el) => {
                quickButtonRefs.current[index] = el;
              }}
              onClick={() => onGoToQuestion(index + 1)}
              className={`h-8 w-8 min-h-8 min-w-8 rounded-lg text-xs font-semibold ${statusClasses(status)}`}
              aria-label={`Question ${index + 1}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}



