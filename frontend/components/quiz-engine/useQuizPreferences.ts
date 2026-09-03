"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEYS = {
  hideQuestionNumbers: "quiz_hide_question_numbers",
  hideViewSolution: "quiz_hide_view_solution",
  hideAiTutor: "quiz_hide_ai_tutor",
} as const;

function readPreference(key: string) {
  return window.localStorage.getItem(key) === "true";
}

function writePreference(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {}
}

export function useQuizPreferences() {
  const [hideQuestionNumbers, setHideQuestionNumbers] = useState(false);
  const [hideViewSolution, setHideViewSolution] = useState(false);
  const [hideAiTutor, setHideAiTutor] = useState(false);

  useEffect(() => {
    try {
      setHideQuestionNumbers(readPreference(STORAGE_KEYS.hideQuestionNumbers));
      setHideViewSolution(readPreference(STORAGE_KEYS.hideViewSolution));
      setHideAiTutor(readPreference(STORAGE_KEYS.hideAiTutor));
    } catch {}
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

  return {
    hideQuestionNumbers,
    hideViewSolution,
    hideAiTutor,
    toggleHideQuestionNumbers,
    toggleHideViewSolution,
    toggleHideAiTutor,
    toggleHideBoth,
  };
}
