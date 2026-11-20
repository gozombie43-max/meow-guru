import { useEffect, useMemo, useRef, useState } from "react";
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
  context = "",
  includeSolution = false
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

  const hasNativeContent = hasNativeQuestion && hasNativeOptions && (!includeSolution || hasNativeSolution);
  const hasQuestion = Boolean(currentQ);
  const questionContext = `${context} ${currentQ?.concept ?? ""} ${currentQ?.chapter ?? ""}`;
  const rawQuestion = hasNativeQuestion ? "" : (currentQ?.question ?? "");
  const rawOptionsJson = hasNativeOptions ? "" : JSON.stringify(currentQ?.options ?? null);
  const rawSolution = !includeSolution || hasNativeSolution ? "" : (currentQ?.solution ?? "");

  // Memoize translation planning on primitive values so fresh inline object/array props
  // never cause redundant regex masking or re-trigger effects.
  const plan = useMemo(() => {
    const parsedOptions = rawOptionsJson ? (JSON.parse(rawOptionsJson) as string[] | null) : null;
    return planQuestionTranslation(
      {
        question: rawQuestion,
        options: parsedOptions ?? undefined,
        solution: rawSolution,
      },
      questionContext,
    );
  }, [rawQuestion, rawOptionsJson, rawSolution, questionContext]);

  const sourceTexts = plan.source;
  const key = useMemo(
    () => JSON.stringify([activeLang, sourceTexts, questionContext]),
    [activeLang, sourceTexts, questionContext],
  );

  const planRef = useRef(plan);
  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  const nextCandidate = upcomingQuestions[0];
  const nextNative =
    activeLang !== "en" && nextCandidate?.translations
      ? (nextCandidate.translations as Record<string, TranslationData>)[activeLang]
      : undefined;
  const nextNeedsTranslation = Boolean(
    activeLang !== "en"
      && !skipTranslation
      && nextCandidate
      && nextCandidate.questionType !== "image_mcq"
      && !(nextNative?.question && nextNative.options?.length === nextCandidate.options?.length),
  );
  const nextQuestionText = nextNeedsTranslation && !nextNative?.question ? (nextCandidate?.question ?? "") : "";
  const nextOptionsJson =
    nextNeedsTranslation && nextNative?.options?.length !== nextCandidate?.options?.length
      ? JSON.stringify(nextCandidate?.options ?? null)
      : "";
  const nextContext = nextCandidate ? `${context} ${nextCandidate.concept ?? ""} ${nextCandidate.chapter ?? ""}` : "";

  const upcomingTexts = useMemo(() => {
    if (!nextNeedsTranslation) return [] as string[];
    const parsedOptions = nextOptionsJson ? (JSON.parse(nextOptionsJson) as string[] | null) : null;
    return planQuestionTranslation(
      {
        question: nextQuestionText,
        options: parsedOptions ?? undefined,
        solution: "",
      },
      nextContext,
    ).texts;
  }, [nextNeedsTranslation, nextQuestionText, nextOptionsJson, nextContext]);

  const upcomingKey = useMemo(() => JSON.stringify(upcomingTexts), [upcomingTexts]);
  const upcomingTextsRef = useRef(upcomingTexts);
  useEffect(() => {
    upcomingTextsRef.current = upcomingTexts;
  }, [upcomingTexts]);

  // Translate the active question only when its own serialized key/language changes.
  useEffect(() => {
    if (activeLang === "en" || skipTranslation || hasNativeContent || !hasQuestion) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;
    const currentPlan = planRef.current;

    void translate(currentPlan.texts, activeLang, false, controller.signal).then((translated) => {
      if (cancelled || controller.signal.aborted) return;
      setCompleted({ key, texts: currentPlan.restore(translated) });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeLang, key, skipTranslation, hasNativeContent, hasQuestion, translate]);

  // Prefetch one upcoming question independently—even when the current question has native content.
  useEffect(() => {
    if (activeLang === "en" || skipTranslation || upcomingTextsRef.current.length === 0) {
      return;
    }

    const controller = new AbortController();
    void translate(upcomingTextsRef.current, activeLang, true, controller.signal);

    return () => {
      controller.abort();
    };
  }, [activeLang, skipTranslation, upcomingKey, translate]);

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
    displayedSolution = !includeSolution ? displayedSolution : hasNativeSolution ? (nativeTranslation?.solution as string) : fallbackDisplayed[fallbackDisplayed.length - 1];
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
