"use client";

import StudyModeStartView from "@/app/(app)/english/_shared/study-mode-start";

export default function HomonymsHomophonesStudyModePage() {
  return (
    <StudyModeStartView
      title="Homonyms & Homophones"
      slug="homonyms-homophones"
      subtitle="Bilingual study deck with Bengali translations and usage definitions."
      quizHref="/english/homonyms-homophones/study-mode/quiz"
      backHref="/english/homonyms-homophones"
    />
  );
}
