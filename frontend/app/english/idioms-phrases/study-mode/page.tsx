"use client";

import React from "react";
import StudyModeStartView from "@/app/english/_shared/study-mode-start";

export default function IdiomsPhrasesStudyModePage() {
  return (
    <StudyModeStartView
      title="Idioms & Phrases"
      slug="idioms-phrases"
      subtitle="Bilingual study deck with Bengali translations and usage definitions."
      quizHref="/english/idioms-phrases/study-mode/quiz"
      backHref="/english/idioms-phrases"
    />
  );
}