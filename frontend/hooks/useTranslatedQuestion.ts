import { useEffect, useState } from "react";
import { getCachedTranslation, useTranslation } from "@/hooks/useTranslation";
import { planQuestionTranslation } from "@/lib/question-translation";

type TranslatableQuestion = {
  question?: string;
  options?: string[];
  solution?: string;
  translations?: {
    bn?: {
      question?: string;
      options?: string[];
      solution?: string;
    };
    hi?: {
      question?: string;
      options?: string[];
      solution?: string;
    };
  };
  questionType?: string;
  concept?: string;
  chapter?: string;
};

type TranslationData = { question?: string; options?: string[]; solution?: string };

export function useTranslatedQuestion<T extends TranslatableQuestion>(
  currentQ: T | undefined,
  skipTranslation = false,
  upcomingQuestions: T[] = [],
  context = ""
) {
  const { activeLang, setActiveLang, translate } = useTranslation();
  const [completed, setCompleted] = useState<{ key: string; texts: string[] } | null>(null);

  const nativeTranslation =
    activeLang !== "en" && currentQ?.translations
      ? (currentQ.translations as Record<string, TranslationData>)[activeLang]
      : undefined;

  const hasNativeQuestion =
    typeof nativeTranslation?.question === "string" &&
    nativeTranslation.question.trim().length > 0;

  const hasNativeOptions =
    Array.isArray(nativeTranslation?.options) &&
    nativeTranslation.options.length === currentQ?.options?.length;

  const hasNativeSolution =
    typeof nativeTranslation?.solution === "string" &&
    nativeTranslation.solution.trim().length > 0;

  const hasNativeContent = hasNativeQuestion && hasNativeOptions && hasNativeSolution;

  const questionContext = `${context} ${currentQ?.concept ?? ""} ${currentQ?.chapter ?? ""}`;
  
  // Create a pseudo-question containing only missing parts for translation
  const fallbackQuestion = {
    question: hasNativeQuestion ? "" : currentQ?.question,
    options: hasNativeOptions ? undefined : currentQ?.options,
    solution: hasNativeSolution ? "" : currentQ?.solution,
  };

  const plan = planQuestionTranslation(fallbackQuestion, questionContext);
  const sourceTexts = plan.source;
  const key = JSON.stringify([activeLang, sourceTexts, questionContext]);

  const upcomingKey = JSON.stringify(upcomingQuestions.slice(0, 3)
    .filter((q) => q.questionType !== "image_mcq")
    .filter((q) => {
       if (activeLang === "en") return false;
       const t = (q.translations as Record<string, TranslationData> | undefined)?.[activeLang];
       const qText = t?.question;
       const opts = t?.options;
       const sol = t?.solution;
       return !(qText && opts?.length === q.options?.length && sol);
    })
    .map((q) => {
       const t = (q.translations as Record<string, TranslationData> | undefined)?.[activeLang];
       const fallbackQ = {
          question: t?.question ? "" : q.question,
          options: (t?.options?.length === q.options?.length) ? undefined : q.options,
          solution: t?.solution ? "" : q.solution,
       };
       return planQuestionTranslation(fallbackQ, `${context} ${q.concept ?? ""} ${q.chapter ?? ""}`).texts;
    }));

  useEffect(() => {
    if (activeLang === "en" || skipTranslation || hasNativeContent) {
      return;
    }

    let cancelled = false;
    const [, allTexts, translationContext] = JSON.parse(key) as [string, string[], string];
    // allTexts corresponds to the source from fallbackQuestion, length is 2 + options.length
    // options are in the middle.
    
    // Construct the fallbackQuestion again based on allTexts.
    const fallbackQ = {
      question: allTexts[0],
      options: allTexts.slice(1, -1),
      solution: allTexts[allTexts.length - 1]
    };

    const currentPlan = planQuestionTranslation(fallbackQ, translationContext);
    
    // Only translate the texts that aren't empty? `planQuestionTranslation` already masks empty strings if handled, but we can just pass currentPlan.texts
    translate(currentPlan.texts, activeLang).then(async (translated) => {
      if (cancelled) return;
      setCompleted({ key, texts: currentPlan.restore(translated) });
      
      for (const texts of JSON.parse(upcomingKey) as string[][]) {
        if (cancelled) break;
        await translate(texts, activeLang, true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeLang, key, upcomingKey, skipTranslation, hasNativeContent, translate]);

  const useSourceText = !currentQ || activeLang === "en" || skipTranslation;
  const cached = plan.texts.map((text) => getCachedTranslation(text, activeLang));
  const ready = completed?.key === key ? completed.texts
    : cached.every((text) => text !== undefined) ? plan.restore(cached as string[]) : null;

  // displayed array will match the structure of plan.source: [question, ...options, solution]
  const fallbackDisplayed = useSourceText ? sourceTexts : ready ?? sourceTexts;

  let displayedQuestion = currentQ?.question ?? "";
  let displayedOptions = currentQ?.options ?? [];
  let displayedSolution = currentQ?.solution ?? "";

  if (activeLang !== "en" && !skipTranslation) {
    displayedQuestion = hasNativeQuestion ? (nativeTranslation?.question as string) : fallbackDisplayed[0];
    displayedOptions = hasNativeOptions ? (nativeTranslation?.options as string[]) : fallbackDisplayed.slice(1, fallbackDisplayed.length - 1);
    displayedSolution = hasNativeSolution ? (nativeTranslation?.solution as string) : fallbackDisplayed[fallbackDisplayed.length - 1];
  }

  return {
    activeLang,
    setActiveLang,
    isTranslating: !useSourceText && !hasNativeContent && !ready,
    displayedQuestion,
    displayedOptions,
    displayedSolution,
  };
}
