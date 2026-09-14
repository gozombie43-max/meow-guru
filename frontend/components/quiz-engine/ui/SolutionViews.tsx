import { useBackLayer } from "@/hooks/useAppNavigation";
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, X } from 'lucide-react';
import RichContent from '@/components/RichContent';
import MathRenderer from '@/components/MathRenderer';
import { formatMathBookSolutionLines } from '../utils';
import { useQuizTheme } from '../QuizThemeProvider';

export function SolutionBottomSheet({
  isOpen,
  solution,
  questionNumber,
  correctOptionIndex,
  correctOptionText,
  onClose,
}: {
  isOpen: boolean;
  solution: string;
  questionNumber: number;
  correctOptionIndex: number;
  correctOptionText: string;
  onClose: () => void;
}) {
  useBackLayer(isOpen, onClose);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isHolding, setIsHolding] = React.useState(false);
  const holdTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const dragStartRef = React.useRef<{ startY: number; startTime: number; currentY: number } | null>(null);

  React.useEffect(() => {
    if (!isOpen) {
      setDragOffset(0);
      setIsDragging(false);
      setIsHolding(false);
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    }
  }, [isOpen]);

  React.useEffect(() => {
    return () => {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    };
  }, []);

  const handleHeaderPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest("input") ||
      target.closest("textarea")
    ) {
      return;
    }

    if (e.button !== 0) return;

    const startY = e.clientY;
    const startTime = Date.now();
    dragStartRef.current = { startY, startTime, currentY: startY };
    setIsDragging(true);
    setIsHolding(true);

    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // pointer capture fallback
      }
    }

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      setIsHolding(false);
      onClose();
    }, 450);
  };

  const handleHeaderPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    const { startY } = dragStartRef.current;
    const currentY = e.clientY;
    dragStartRef.current.currentY = currentY;
    const deltaY = currentY - startY;

    if (Math.abs(deltaY) > 8 && holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
      setIsHolding(false);
    }

    if (deltaY > 0) {
      setDragOffset(deltaY);
    } else {
      setDragOffset(deltaY * 0.15);
    }
  };

  const handleHeaderPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsHolding(false);

    if (!dragStartRef.current) {
      setIsDragging(false);
      return;
    }

    const { startY, startTime } = dragStartRef.current;
    const deltaY = e.clientY - startY;
    const elapsed = Math.max(Date.now() - startTime, 1);
    const velocity = deltaY / elapsed;

    dragStartRef.current = null;
    setIsDragging(false);

    if (deltaY > 70 || (deltaY > 20 && velocity > 0.4)) {
      onClose();
    } else {
      setDragOffset(0);
    }
  };

  const handleHeaderPointerCancel = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    dragStartRef.current = null;
    setIsHolding(false);
    setIsDragging(false);
    setDragOffset(0);
  };

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
          animate={{ opacity: dragOffset > 0 ? Math.max(1 - dragOffset / 400, 0.2) : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Question solution"
            className={`ios-solution-sheet ${isDragging ? "is-dragging" : ""} ${isHolding ? "is-holding" : ""}`}
            initial={{ y: "100%", opacity: 0.95 }}
            animate={{ y: dragOffset, opacity: dragOffset > 0 ? Math.max(1 - dragOffset / 500, 0.4) : 1 }}
            exit={{ y: "100%", opacity: 0.95 }}
            transition={isDragging ? { duration: 0 } : {
              type: "spring",
              stiffness: 240,
              damping: 28,
              mass: 0.9,
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className={`ios-solution-drag-zone ${isHolding ? "is-holding" : ""} ${isDragging ? "is-dragging" : ""}`}
              onPointerDown={handleHeaderPointerDown}
              onPointerMove={handleHeaderPointerMove}
              onPointerUp={handleHeaderPointerUp}
              onPointerCancel={handleHeaderPointerCancel}
              title="Hold or drag down to close"
            >
              <div className="ios-sheet-handle-container">
                <div className="ios-sheet-handle">
                  <div className={`ios-hold-indicator ${isHolding ? "active" : ""}`} />
                </div>
              </div>

              <div data-ui-chrome="header" className="ios-solution-header">
                <button data-ui-button="icon" type="button" onClick={onClose} aria-label="Back to quiz" className="ios-done-btn">
                  <ArrowLeft aria-hidden="true" />
                </button>
                <h3 className="ios-solution-title">Worked Solution</h3>
                <span className="ios-header-placeholder" aria-hidden="true" />
              </div>
            </div>

            <div className="ios-solution-body">
              {solutionLines.length > 0 ? (
                <div className="ios-solution-container">
                  <p className="ios-solution-answer-summary">
                    Question {questionNumber}
                    <span aria-hidden="true"> · </span>
                    Option ({optionLabel}) is correct
                    {correctOptionText && (
                      <>
                        <span aria-hidden="true"> — </span>
                        <span className="ios-solution-answer-value">
                          <RichContent text={correctOptionText} />
                        </span>
                      </>
                    )}
                  </p>

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
                background: var(--dark-surface);
                border-radius: 28px 28px 0 0;
                overflow: hidden;
                box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.12);
                border-bottom: none;
                padding-bottom: calc(env(safe-area-inset-bottom) + 16px);
                touch-action: pan-y;
              }
              .ios-solution-drag-zone {
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                cursor: grab;
                touch-action: none;
                user-select: none;
                -webkit-user-select: none;
              }
              .ios-solution-drag-zone.is-dragging,
              .ios-solution-drag-zone.is-holding {
                cursor: grabbing;
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
                position: relative;
                overflow: hidden;
                transition: transform 0.2s ease, background 0.2s ease;
              }
              .ios-solution-drag-zone:hover .ios-sheet-handle {
                background: rgba(10, 132, 255, 0.4);
              }
              .ios-solution-drag-zone.is-holding .ios-sheet-handle {
                transform: scaleY(1.3);
              }
              .ios-hold-indicator {
                position: absolute;
                inset: 0;
                background: #0a84ff;
                border-radius: 99px;
                transform: scaleX(0);
                transform-origin: center;
                opacity: 0;
                transition: transform 0.45s cubic-bezier(0.1, 0.8, 0.2, 1), opacity 0.15s ease;
              }
              .ios-hold-indicator.active {
                transform: scaleX(1);
                opacity: 1;
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
              .ios-solution-answer-summary {
                margin: 0 0 18px;
                color: rgba(235, 235, 245, 0.62);
                font-size: 15px;
                font-weight: 500;
                line-height: 1.45;
                letter-spacing: 0;
              }
              .ios-solution-answer-value {
                color: rgba(245, 245, 247, 0.88);
                font-weight: 600;
              }
              .ios-solution-content-text {
                font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
                font-size: 18px;
                line-height: 1.85;
                color: var(--light-canvas);
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

              /* Light Theme Overrides (Palette: #F6F8FA White / #E6EAEF Ice Blue / #FFFFFF Pure White) */
              .ios-solution-backdrop[data-theme="light"] {
                background: rgba(15, 23, 42, 0.4);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-sheet {
                background: #FFFFFF;
                border-color: var(--light-border);
                color: var(--light-text);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-sheet-handle {
                background: var(--light-border);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-drag-zone:hover .ios-sheet-handle {
                background: rgba(0, 122, 255, 0.35);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-hold-indicator {
                background: #007aff;
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-header {
                border-bottom-color: var(--light-border);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-title {
                color: var(--light-text);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-done-btn {
                color: var(--light-accent);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-content-text {
                color: var(--light-text);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-answer-summary {
                color: var(--light-text-secondary);
              }
              .ios-solution-backdrop[data-theme="light"] .ios-solution-answer-value {
                color: var(--light-text);
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
                  display: flex;
                  padding-top: 10px;
                  padding-bottom: 2px;
                }
                .ios-solution-header {
                  padding: 12px 28px 16px;
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
        <button data-ui-button="icon"
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

