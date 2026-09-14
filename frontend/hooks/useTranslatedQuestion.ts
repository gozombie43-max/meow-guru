import { useEffect, useState } from "react";
import { getCachedTranslation, useTranslation } from "@/hooks/useTranslation";
import { planQuestionTranslation } from "@/lib/question-translation";

type TranslatableQuestion = {
  question?: string;
  options?: string[];
  questionType?: string;
  concept?: string;
  chapter?: string;
};

export function useTranslatedQuestion<T extends TranslatableQuestion>(
  currentQ: T | undefined,
  skipTranslation = false,
  upcomingQuestions: T[] = [],
  context = ""
) {
  const { activeLang, setActiveLang, translate } = useTranslation();
  const [completed, setCompleted] = useState<{ key: string; texts: string[] } | null>(null);
  const questionContext = `${context} ${currentQ?.concept ?? ""} ${currentQ?.chapter ?? ""}`;
  const plan = planQuestionTranslation(currentQ ?? {}, questionContext);
  const sourceTexts = plan.source;
  const key = JSON.stringify([activeLang, sourceTexts, questionContext]);
  // Stable content dependencies prevent unrelated quiz renders restarting work.
  const upcomingKey = JSON.stringify(upcomingQuestions.slice(0, 3)
    .filter((q) => q.questionType !== "image_mcq")
    .map((q) => planQuestionTranslation(q, `${context} ${q.concept ?? ""} ${q.chapter ?? ""}`).texts));

  useEffect(() => {
    if (activeLang === "en" || skipTranslation) return;

    let cancelled = false;
    const [, allTexts, translationContext] = JSON.parse(key) as [string, string[], string];
    const currentPlan = planQuestionTranslation({ question: allTexts[0], options: allTexts.slice(1) }, translationContext);
    translate(currentPlan.texts, activeLang).then(async (translated) => {
      if (cancelled) return;
      setCompleted({ key, texts: currentPlan.restore(translated) });
      // Foreground first; keep background traffic bounded and stop on navigation.
      for (const texts of JSON.parse(upcomingKey) as string[][]) {
        if (cancelled) break;
        await translate(texts, activeLang, true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeLang, key, upcomingKey, skipTranslation, translate]);

  const useSourceText = !currentQ || activeLang === "en" || skipTranslation;
  const cached = plan.texts.map((text) => getCachedTranslation(text, activeLang));
  const ready = completed?.key === key ? completed.texts
    : cached.every((text) => text !== undefined) ? plan.restore(cached as string[]) : null;
  // Show the new source question immediately, never the previous translation.
  const displayed = useSourceText ? sourceTexts : ready ?? sourceTexts;

  return {
    activeLang,
    setActiveLang,
    isTranslating: !useSourceText && !ready,
    displayedQuestion: displayed[0],
    displayedOptions: displayed.slice(1),
  };
}
