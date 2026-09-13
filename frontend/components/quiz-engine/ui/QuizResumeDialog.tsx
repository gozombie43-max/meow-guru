"use client";

import { useEffect, useRef } from "react";
import { History, Play, RotateCcw } from "lucide-react";
import styles from "./QuizResumeDialog.module.css";

type Props = {
  theme: string;
  currentIndex: number;
  answered: number;
  total: number;
  onResume: () => void;
  onRestart: () => void;
  onCancel: () => void;
};

export function QuizResumeDialog({ theme, currentIndex, answered, total, onResume, onRestart, onCancel }: Props) {
  const resumeRef = useRef<HTMLButtonElement>(null);
  const progress = total > 0 ? Math.min(100, Math.max(0, answered / total * 100)) : 0;

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resumeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onCancel]);

  return (
    <div
      className={styles.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
      role="presentation"
      data-theme={theme}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quiz-resume-title"
        aria-describedby="quiz-resume-description"
        data-theme={theme}
      >
        <div className={styles.content}>
          <div className={styles.icon}><History size={28} aria-hidden="true" /></div>
          <h2 id="quiz-resume-title">Resume Quiz?</h2>
          <p id="quiz-resume-description">Pick up where you left off.</p>
          <div className={styles.progressCard}>
            <div className={styles.progressLabel}>
              <strong>Question {currentIndex + 1}</strong>
              <span>{answered} answered{total > 0 ? ` of ${total}` : ""}</span>
            </div>
            <progress className={styles.progress} max={100} value={progress} aria-label="Questions answered" />
          </div>
        </div>
        <div className={styles.actions}>
          <button ref={resumeRef} type="button" data-ui-button="primary" onClick={onResume}>
            <Play aria-hidden="true" /> Resume Quiz
          </button>
          <button type="button" data-ui-button="secondary" onClick={onRestart} aria-describedby="quiz-restart-hint">
            <RotateCcw aria-hidden="true" /> Restart Quiz
          </button>
          <p id="quiz-restart-hint" className={styles.hint}>Restart clears your saved progress.</p>
          <button type="button" data-ui-button="state" className={styles.cancel} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
