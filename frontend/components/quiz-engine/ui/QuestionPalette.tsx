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
            className="h-full w-full p-4"
            style={{ background: "var(--quiz-surface)", color: "var(--quiz-text)" }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-[color:var(--quiz-text)]">
                Question Palette
              </h3>
              <button
                onClick={onClose}
                className="quiz-icon-button h-12 min-w-12 rounded-xl shadow-sm transition-colors"
                aria-label="Close question palette"
              >
                <X className="mx-auto h-5 w-5" />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap gap-2 text-xs text-[color:var(--quiz-text-muted)]">
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
      className="rounded-2xl border p-4 shadow-sm"
      style={{ background: "var(--quiz-card-bg)", borderColor: "var(--quiz-border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[color:var(--quiz-text)]">
          Question Palette
        </h3>
        <span className="text-xs font-semibold text-[color:var(--quiz-text-muted)]">
          {currentIndex + 1}/{total}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-xs text-[color:var(--quiz-text-muted)]">
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
  );
}

