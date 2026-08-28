import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { QuizQuestion } from '../types';
import { getQuestionStatus, statusClasses } from '../utils';

export function QuestionPaletteModal({
  isOpen,
  total,
  currentIndex,
  selectedAnswers,
  questions,
  submittedQuestions,
  onClose,
  onGoToQuestion,
}: {
  isOpen: boolean;
  total: number;
  currentIndex: number;
  selectedAnswers: Record<number, number>;
  questions: QuizQuestion[];
  submittedQuestions: Set<number>;
  onClose: () => void;
  onGoToQuestion: (questionNumber: number) => void;
}) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[90] bg-[var(--quiz-overlay)] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="flex flex-col h-full w-full overflow-hidden"
            style={{ background: "var(--quiz-surface)", color: "var(--quiz-text)" }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Fixed Sticky Header */}
            <div
              className="relative flex-none px-4 py-3.5 border-b flex items-center justify-center"
              style={{ borderColor: "var(--quiz-divider, var(--quiz-border))", background: "var(--quiz-surface-muted, #F6F8FA)" }}
            >
              <h3 className="text-base font-bold text-center text-[color:var(--quiz-text)]">
                Questions
              </h3>
              <button
                onClick={onClose}
                className="quiz-icon-button absolute right-4 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl shadow-sm transition-colors flex items-center justify-center"
                aria-label="Close question palette"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Numbers Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="flex flex-wrap gap-2 text-xs text-[color:var(--quiz-text-muted)]">
                <span className="rounded-md border border-violet-300 bg-violet-100 px-2 py-1">
                  Current
                </span>
                <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-1">
                  Answered
                </span>
                <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1">
                  Correct
                </span>
                <span className="rounded-md border border-rose-300 bg-rose-100 px-2 py-1">
                  Wrong
                </span>
                <span
                  className="rounded-md border px-2 py-1"
                  style={{
                    background: "var(--quiz-status-empty-bg)",
                    borderColor: "var(--quiz-status-empty-border)",
                    color: "var(--quiz-status-empty-text)",
                  }}
                >
                  Not Answered
                </span>
              </div>

              <div
                className="rounded-2xl border p-3 shadow-sm"
                style={{ background: "var(--quiz-card-bg)", borderColor: "var(--quiz-border)" }}
              >
                <div className="question-grid question-grid--palette">
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
                        onClick={() => {
                          onGoToQuestion(index + 1);
                          onClose();
                        }}
                        className={`question-button min-h-12 rounded-xl text-sm font-semibold ${statusClasses(status)}`}
                      >
                        {index + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function QuestionPalettePanel({
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
  return (
    <div
      className="flex flex-col rounded-2xl border shadow-sm max-h-[540px] xl:max-h-[calc(100vh-180px)] overflow-hidden"
      style={{ background: "var(--quiz-card-bg)", borderColor: "var(--quiz-border)" }}
    >
      {/* Fixed Sticky Header */}
      <div
        className="relative flex-none px-4 py-3.5 border-b flex items-center justify-center"
        style={{ borderColor: "var(--quiz-divider, var(--quiz-border))", background: "var(--quiz-surface-muted, #F6F8FA)" }}
      >
        <h3 className="text-base font-bold text-center text-[color:var(--quiz-text)]">
          Questions
        </h3>
        <span className="absolute right-4 text-xs font-semibold text-[color:var(--quiz-text-muted)]">
          {currentIndex + 1}/{total}
        </span>
      </div>

      {/* Scrollable Numbers Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div className="flex flex-wrap gap-2 text-xs text-[color:var(--quiz-text-muted)]">
          <span className="rounded-md border border-violet-300 bg-violet-100 px-2 py-1">
            Current
          </span>
          <span className="rounded-md border border-amber-300 bg-amber-100 px-2 py-1">
            Answered
          </span>
          <span className="rounded-md border border-emerald-300 bg-emerald-100 px-2 py-1">
            Correct
          </span>
          <span className="rounded-md border border-rose-300 bg-rose-100 px-2 py-1">
            Wrong
          </span>
          <span
            className="rounded-md border px-2 py-1"
            style={{
              background: "var(--quiz-status-empty-bg)",
              borderColor: "var(--quiz-status-empty-border)",
              color: "var(--quiz-status-empty-text)",
            }}
          >
            Not Answered
          </span>
        </div>

        <div className="question-grid question-grid--palette">
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
                onClick={() => onGoToQuestion(index + 1)}
                className={`question-button min-h-12 rounded-xl text-sm font-semibold ${statusClasses(status)}`}
              >
                {index + 1}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

