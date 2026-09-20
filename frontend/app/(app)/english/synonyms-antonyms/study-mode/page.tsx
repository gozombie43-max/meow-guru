"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import StudyModeStartView from "@/app/(app)/english/_shared/study-mode-start";

export default function SynonymsAntonymsStudyModePage() {
  const router = useRouter();
  useEffect(() => { router.prefetch("/english/synonyms-antonyms/study-mode/quiz"); }, [router]);
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