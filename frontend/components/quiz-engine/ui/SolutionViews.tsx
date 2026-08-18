import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import RichContent from '@/components/RichContent';
import MathText from '@/components/MathText';
import MathRenderer from '@/components/MathRenderer';
import { QuizQuestionRecord } from '../types';
import { formatMathBookSolutionLines, useQuizTheme } from '../utils';

export function SolutionBottomSheet({
  isOpen,
  solution,
  questionNumber,
  correctOptionIndex,
  onClose,
}: {
  isOpen: boolean;
  solution: string;
  questionNumber: number;
  correctOptionIndex: number;
  onClose: () => void;
}) {
  const solutionLines = useMemo(
    () => formatMathBookSolutionLines(solution),
    [solution]
  );
  const solutionHasImage = /!\[[^\]]*\]\([^)]+\)/.test(solution);
  const optionLabel =
    correctOptionIndex >= 0 && correctOptionIndex < 26
      ? String.fromCharCode(65 + correctOptionIndex)
      : "A";
  const theme = useQuizTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ios-solution-backdrop"
          data-theme={theme}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Question solution"
            className="ios-solution-sheet"
            initial={{ y: "100%", opacity: 0.95 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0.95 }}
            transition={{
              type: "spring",
              stiffness: 240,
              damping: 28,
              mass: 0.9,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="ios-sheet-handle-container">
              <div className="ios-sheet-handle" />
            </div>

            <div className="ios-solution-header">
              <span className="ios-header-placeholder"></span>
              <h3 className="ios-solution-title">Worked Solution</h3>
              <button
                type="button"
                onClick={onClose}
                className="ios-done-btn"
                aria-label="Close solution"
              >
                Done
              </button>
            </div>

            <div className="ios-solution-body">
              {solutionLines.length > 0 ? (
                <div className="ios-solution-container">
                  <div className="ios-solution-badge">
                    <span className="ios-badge-qnum">Question {questionNumber}</span>
                    <span className="ios-badge-divider">•</span>
                    <span className="ios-badge-correct">Option ({optionLabel}) is Correct</span>
                  </div>

                  <div className="ios-solution-content-text">
                    {solutionHasImage ? (
                      <RichContent text={solution} />
                    ) : (
                      solutionLines.map((line: string, index: number) => {
                        const isDisplayEquation = /^\\\[[\s\S]*\\\]$/.test(line);
                        return (
                          <div
                            key={`worked-line-${index}`}
                            className={`ios-solution-step ${isDisplayEquation ? "is-equation" : ""}`}
                          >
                            <MathRenderer text={line} className="leading-relaxed" />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-center py-12 opacity-60 text-base">
                  Solution is not available for this question yet.
                </p>
              )}
            </div>

            <style jsx global>{`
              .ios-solution-backdrop {
                position: fixed;
                inset: 0;
                z-index: 9999;
                background: rgba(0, 0, 0, 0.65);
                backdrop-filter: blur(8px);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-end;
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif;
              }
              .ios-solution-sheet {
                width: 100%;
                max-width: 680px;
                max-height: 86svh;
                display: flex;
                flex-direction: column;
                background: #1c1c1e;
                border-radius: 28px 28px 0 0;
                overflow: hidden;
                box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-bottom: none;
                padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
              }
              .ios-sheet-handle-container {
                width: 100%;
                display: flex;
                justify-content: center;
                padding-top: 10px;
                padding-bottom: 4px;
                flex-shrink: 0;
              }
              .ios-sheet-handle {
                width: 44px;
                height: 5px;
                border-radius: 99px;
                background: rgba(255, 255, 255, 0.22);
              }
              .ios-solution-header {
                display: grid;
                grid-template-columns: 1fr auto 1fr;
                align-items: center;
                padding: 10px 20px 14px 20px;
                border-bottom: 0.5px solid rgba(255, 255, 255, 0.12);
                flex-shrink: 0;
              }
              .ios-solution-title {
                margin: 0;
                font-size: 18px;
                font-weight: 600;
                color: #ffffff;
                text-align: center;
                letter-spacing: -0.01em;
              }
              .ios-done-btn {
                background: transparent;
                border: none;
                padding: 4px 0 4px 12px;
                font-size: 17px;
                font-weight: 600;
                color: #0a84ff;
                cursor: pointer;
                justify-self: end;
              }
              .ios-done-btn:active {
                opacity: 0.6;
              }
              .ios-solution-body {
                flex: 1;
                overflow-y: auto;
                padding: 24px 22px 48px 22px;
                overscroll-behavior: contain;
              }
              .ios-solution-container {
                display: flex;
                flex-direction: column;
              }
              .ios-solution-badge {
                display: inline-flex;
                align-items: center;
                align-self: flex-start;
                gap: 8px;
                background: rgba(48, 209, 88, 0.16);
                border: 1px solid rgba(48, 209, 88, 0.35);
                color: #30d158;
                font-size: 15px;
                font-weight: 600;
                padding: 7px 16px;
                border-radius: 99px;
                margin-bottom: 22px;
                letter-spacing: 0.01em;
              }
              .ios-badge-divider {
                opacity: 0.6;
              }
              .ios-solution-content-text {
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
                font-size: 18px;
                line-height: 1.85;
                color: #f5f5f7;
                letter-spacing: 0.012em;
              }
              .ios-solution-step {
                margin-top: 14px;
                margin-bottom: 14px;
              }
              .ios-solution-step:first-of-type {
                margin-top: 0;
              }
              .ios-solution-step.is-equation {
                text-align: center;
                margin-top: 24px;
                margin-bottom: 24px;
              }

              /* Light Theme Overrides */
              .ios-solution-backdrop[data-theme="light"] {
                background: rgba(0, 0, 0, 0.35);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-sheet {
                background: #ffffff;
                border-color: rgba(0, 0, 0, 0.1);
                color: #1d1d1f;
              }
              .ios-solution-backdrop[data-theme="light"] .ios-sheet-handle {
                background: rgba(0, 0, 0, 0.18);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-header {
                border-bottom-color: rgba(0, 0, 0, 0.08);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-title {
                color: #1d1d1f;
              }
              .ios-solution-backdrop[data-theme="light"] .ios-done-btn {
                color: #007aff;
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-content-text {
                color: #1d1d1f;
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-badge {
                background: rgba(52, 199, 89, 0.12);
                border-color: rgba(52, 199, 89, 0.3);
                color: #248a3d;
              }

              /* PC / Desktop optimization */
              @media (min-width: 640px) {
                .ios-solution-backdrop {
                  justify-content: center;
                  padding: 32px;
                }
                .ios-solution-sheet {
                  max-height: 78vh;
                  border-radius: 26px !important;
                  border: 1px solid rgba(255, 255, 255, 0.16);
                  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
                }
                .ios-sheet-handle-container {
                  display: none;
                }
                .ios-solution-header {
                  padding: 16px 28px;
                }
                .ios-solution-body {
                  padding: 28px 32px 52px 32px;
                }
              }
            `}</style>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function SolutionSidePanel({
  isOpen,
  solution,
  questionNumber,
  correctOptionIndex,
  onClose,
}: {
  isOpen: boolean;
  solution: string;
  questionNumber: number;
  correctOptionIndex: number;
  onClose: () => void;
}) {
  const solutionLines = useMemo(
    () => formatMathBookSolutionLines(solution),
    [solution]
  );
  const solutionHasImage = /!\[[^\]]*\]\([^)]+\)/.test(solution);
  const optionLabel =
    correctOptionIndex >= 0 && correctOptionIndex < 26
      ? String.fromCharCode(97 + correctOptionIndex)
      : "a";

  if (!isOpen) return null;

  return (
    <div
      className="w-full min-h-[420px] rounded-[28px] border p-4"
      aria-label="Question solution"
      style={{
        background: "var(--quiz-card-bg)",
        borderColor: "var(--quiz-card-border)",
        boxShadow: "var(--quiz-card-shadow)",
        color: "var(--quiz-text)",
        backdropFilter: "var(--quiz-card-blur)",
        WebkitBackdropFilter: "var(--quiz-card-blur)",
      }}
    >
      <div
        className="flex items-center justify-between border-b px-2 pb-3.5"
        style={{ borderColor: "var(--quiz-border)" }}
      >
        <div>
          <p className="text-[15px] font-semibold text-[color:var(--quiz-text)]">
            Worked Solution
          </p>
          <p className="text-[12px] font-medium text-[color:var(--quiz-text-muted)]">
            Sol.{questionNumber}.({optionLabel})
          </p>
        </div>
        <button
          onClick={onClose}
          className="quiz-icon-button inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
          aria-label="Close solution"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div
        className="mt-4 max-h-[72vh] overflow-y-auto rounded-2xl border px-6 py-4 text-[color:var(--quiz-text)]"
        style={{
          background: "var(--quiz-surface-muted)",
          borderColor: "var(--quiz-border)",
          fontFamily: "'Cambria Math', 'STIX Two Text', 'Times New Roman', serif",
          fontSize: 18,
          lineHeight: 1.8,
          textAlign: "left",
          letterSpacing: "-0.01em",
          paddingLeft: "24px",
          paddingRight: "24px",
        }}
      >
        {solutionLines.length > 0 ? (
          <div className="space-y-1.5">
            {solutionHasImage ? (
              <RichContent text={solution} />
            ) : (
              solutionLines.map((line: string, index: number) => {
                const isDisplayEquation = /^\\\[[\s\S]*\\\]$/.test(line);
                return (
                  <div
                    key={`worked-line-panel-${index}`}
                    className={isDisplayEquation ? "text-center" : ""}
                    style={{
                      marginTop: isDisplayEquation ? "0.15rem" : "0",
                      marginBottom: isDisplayEquation ? "0.15rem" : "0",
                    }}
                  >
                    <MathRenderer text={line} className="leading-relaxed" />
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            Solution is not available for this question yet.
          </p>
        )}
      </div>
    </div>
  );
}

