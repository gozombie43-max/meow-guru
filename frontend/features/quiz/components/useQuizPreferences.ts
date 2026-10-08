"use client";

import { useCallback, useEffect, useState } from "react";

export type QuizTextSize = "sm" | "md" | "lg" | number;
export const MIN_QUIZ_TEXT_SIZE = 16;
export const MAX_QUIZ_TEXT_SIZE = 24;
export function getQuizTextSizePixels(size: QuizTextSize) {
  return typeof size === "number" ? size : { sm: 17, md: 20, lg: 23 }[size];
}

function isCustomTextSize(size: number) {
  return Number.isInteger(size) && size >= MIN_QUIZ_TEXT_SIZE && size <= MAX_QUIZ_TEXT_SIZE;
}
export type QuizTextWeight = "low" | "medium" | "high";
export type QuizSpacing = "comfortable" | "compact";

const STORAGE_KEYS = {
  hideQuestionNumbers: "quiz_hide_question_numbers",
  hideViewSolution: "quiz_hide_view_solution",
  hideAiTutor: "quiz_hide_ai_tutor",
  textSize: "quiz_text_size",
  spacing: "quiz_spacing",
  textWeight: "quiz_text_weight",
} as const;

function readPreference(key: string, fallback = false) {
  const saved = window.localStorage.getItem(key);
  return saved === null ? fallback : saved === "true";
}

function writePreference(key: string, value: boolean | string | number) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {}
}

export function useQuizPreferences() {
  const [hideQuestionNumbers, setHideQuestionNumbers] = useState(true);
  const [hideViewSolution, setHideViewSolution] = useState(false);
  const [hideAiTutor, setHideAiTutor] = useState(false);
  const [textSize, setTextSizeState] = useState<QuizTextSize>("md");
  const [textWeight, setTextWeightState] = useState<QuizTextWeight>("medium");
  const [spacing, setSpacingState] = useState<QuizSpacing>("comfortable");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        setHideQuestionNumbers(readPreference(STORAGE_KEYS.hideQuestionNumbers, true));
        setHideViewSolution(readPreference(STORAGE_KEYS.hideViewSolution));
        setHideAiTutor(readPreference(STORAGE_KEYS.hideAiTutor));
        const savedTextSize = window.localStorage.getItem(STORAGE_KEYS.textSize);
        const savedPixels = Number(savedTextSize);
        if (savedTextSize === "sm" || savedTextSize === "md" || savedTextSize === "lg") {
          setTextSizeState(savedTextSize);
        } else if (savedTextSize?.trim() && Number.isInteger(savedPixels) && savedPixels > 0) {
          const size = Math.min(MAX_QUIZ_TEXT_SIZE, Math.max(MIN_QUIZ_TEXT_SIZE, savedPixels));
          setTextSizeState(size);
          if (size !== savedPixels) writePreference(STORAGE_KEYS.textSize, size);
        }
        const weight = window.localStorage.getItem(STORAGE_KEYS.textWeight);
        if (weight === "low" || weight === "medium" || weight === "high") setTextWeightState(weight);
        const savedSpacing = window.localStorage.getItem(STORAGE_KEYS.spacing) as QuizSpacing | null;
        if (savedSpacing === "comfortable" || savedSpacing === "compact") {
          setSpacingState(savedSpacing);
        }
      } catch {}
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleHideQuestionNumbers = useCallback((value: boolean) => {
    setHideQuestionNumbers(value);
    writePreference(STORAGE_KEYS.hideQuestionNumbers, value);
  }, []);

  const toggleHideViewSolution = useCallback((value: boolean) => {
    setHideViewSolution(value);
    writePreference(STORAGE_KEYS.hideViewSolution, value);
  }, []);

  const toggleHideAiTutor = useCallback((value: boolean) => {
    setHideAiTutor(value);
    writePreference(STORAGE_KEYS.hideAiTutor, value);
  }, []);

  const toggleHideBoth = useCallback((value: boolean) => {
    setHideViewSolution(value);
    setHideAiTutor(value);
    writePreference(STORAGE_KEYS.hideViewSolution, value);
    writePreference(STORAGE_KEYS.hideAiTutor, value);
  }, []);

  const setTextSize = useCallback((size: QuizTextSize) => {
    if (typeof size === "number" && !isCustomTextSize(size)) return;
    setTextSizeState(size);
    writePreference(STORAGE_KEYS.textSize, size);
  }, []);

  const setSpacing = useCallback((sp: QuizSpacing) => {
    setSpacingState(sp);
    writePreference(STORAGE_KEYS.spacing, sp);
  }, []);

  const setTextWeight = useCallback((weight: QuizTextWeight) => {
    setTextWeightState(weight);
    writePreference(STORAGE_KEYS.textWeight, weight);
  }, []);

  return {
    textWeight, setTextWeight,
    hideQuestionNumbers,
    hideViewSolution,
    hideAiTutor,
    textSize,
    spacing,
    toggleHideQuestionNumbers,
    toggleHideViewSolution,
    toggleHideAiTutor,
    toggleHideBoth,
    setTextSize,
    setSpacing,
  };
}
