import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";

type TranslatableQuestion = {
  question?: string;
  options?: string[];
};

export function useTranslatedQuestion<T extends TranslatableQuestion>(
  currentQ: T | undefined,
  skipTranslation = false
) {
  const { activeLang, setActiveLang, translate, isTranslating } = useTranslation();
  const [translatedQuestion, setTranslatedQuestion] = useState("");
  const [translatedOptions, setTranslatedOptions] = useState<string[]>([]);

  useEffect(() => {
    if (!currentQ || activeLang === "en" || skipTranslation) return;

    const question = currentQ.question ?? "";
    const options = currentQ.options ?? [];

    let cancelled = false;
    const allTexts = [question, ...options];

    translate(allTexts, activeLang).then((translated) => {
      if (cancelled) return;
      setTranslatedQuestion(translated[0] ?? question);
      setTranslatedOptions(translated.slice(1));
    });

    return () => {
      cancelled = true;
    };
  }, [activeLang, currentQ, skipTranslation, translate]);

  const useSourceText = !currentQ || activeLang === "en" || skipTranslation;
  const displayedQuestion = useSourceText
    ? currentQ?.question ?? ""
    : translatedQuestion;
  const displayedOptions = useSourceText
    ? currentQ?.options ?? []
    : translatedOptions;

  return {
    activeLang,
    setActiveLang,
    isTranslating,
    displayedQuestion,
    displayedOptions,
  };
}
