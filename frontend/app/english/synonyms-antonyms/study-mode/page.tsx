"use client";

import React from "react";
import StudyModeStartView from "@/app/english/_shared/study-mode-start";

export default function SynonymsAntonymsStudyModePage() {
  return (
    <StudyModeStartView
      title="Synonyms & Antonyms"
      slug="synonyms-antonyms"
      subtitle="Bilingual study deck with Bengali translations and usage definitions."
      quizHref="/english/synonyms-antonyms/study-mode/quiz"
      backHref="/english/synonyms-antonyms"
    />
  );
}