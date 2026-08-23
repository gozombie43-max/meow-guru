"use client";

import React from "react";
import StudyModeStartView from "@/app/english/_shared/study-mode-start";

export default function SpellingMisspelledWordsStudyModePage() {
  return (
    <StudyModeStartView
      title="Spelling & Misspelled Words"
      slug="spelling-misspelled-words"
      subtitle="Bilingual study deck with Bengali translations and usage definitions."
      quizHref="/english/spelling-misspelled-words/study-mode/quiz"
      backHref="/english/spelling-misspelled-words"
    />
  );
}