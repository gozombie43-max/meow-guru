"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import StudyModeStartView from "@/app/(app)/english/_shared/study-mode-start";

export default function OneWordSubstitutionStudyModePage() {
  const router = useRouter();
  useEffect(() => { router.prefetch("/english/one-word-substitution/study-mode/quiz"); }, [router]);
  return (
    <StudyModeStartView
      title="One Word Substitution"
      slug="one-word-substitution"
      subtitle="Bilingual study deck with Bengali translations and usage definitions."
      quizHref="/english/one-word-substitution/study-mode/quiz"
      backHref="/english/one-word-substitution"
    />
  );
}