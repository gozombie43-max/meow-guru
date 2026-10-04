"use client";
import { Dialog } from "@/components/ui/Dialog";
import React, { useState, useCallback, useRef, useId } from "react";
import { createPortal } from "react-dom";

import { ChevronDown, Check, X } from "lucide-react";

import { useQuizTheme } from "@/features/quiz/components/QuizThemeProvider";
import styles from "@/features/quiz/components/ui/SeriesStartViews.module.css";

export function IosExamPicker({ value, options, onChange }: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const titleId = useId();
  const quizTheme = useQuizTheme();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleOpen = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      setOpen(false);
    }, (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) ? 0 : 340);
  }, []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) handleClose();
  }, [handleClose]);

  return (
    <div className={styles.iosSelectWrapper}>
      <button
        ref={triggerRef}
        type="button"
        data-ui-button="state"
        className={styles.iosSelect}
        aria-label={`Select exam: ${value || "All Exams"}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={handleOpen}
      >
        {value || "All Exams"}
      </button>
      <ChevronDown size={14} className={styles.iosSelectChevron} />

      {open && createPortal(
        <div
          ref={backdropRef}
          className={`${styles.iosSheetBackdrop} ${visible ? styles.iosSheetBackdropIn : ""}`}
          role="presentation"
          onClick={handleBackdropClick}
        >
          <Dialog onClose={handleClose}
            className={`${styles.examSheet} ${visible ? styles.examSheetIn : ""}`}
            data-theme={quizTheme}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <div className={styles.examSheetHandle} aria-hidden="true" />
            <header className={styles.examSheetHeader}>
              <div>
                <h2 id={titleId}>Select Exam</h2>
                <p>Choose which exam to practice</p>
              </div>
              <button type="button" data-ui-button="icon" aria-label="Close exam picker" onClick={handleClose}>
                <X size={20} />
              </button>
            </header>
            <div className={styles.examSheetOptions} role="group" aria-label="Exams">
              {options.map((exam) => (
                <button key={exam} type="button" data-ui-button="state"
                  className={styles.examSheetOption} aria-pressed={(value || "all") === exam}
                  onClick={() => { onChange(exam === "all" ? "" : exam); handleClose(); }}>
                  <span>{exam === "all" ? "All Exams" : exam}</span>
                  {(value || "all") === exam && <Check size={21} strokeWidth={2.7} aria-hidden="true" />}
                </button>
              ))}
            </div>
          </Dialog>
        </div>,
        document.body,
      )}
    </div>
  );
}
