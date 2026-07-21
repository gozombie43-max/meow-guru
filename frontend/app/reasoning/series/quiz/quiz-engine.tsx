"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useThemeMode } from "@/hooks/useTheme";
import ReasoningQuizEngine from "../../_shared/quiz-engine";

export default function QuizEngine() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode");
  const isConcept = mode === "concept";
  const { theme } = useThemeMode();

  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const devicePrefix = isDesktop ? "mac" : "ios";
  const presentation = isConcept ? `${devicePrefix}-${theme}` : `${devicePrefix}-dark`;

  return (
    <ReasoningQuizEngine
      title="Series"
      slug="series"
      presentation={presentation as any}
    />
  );
}
