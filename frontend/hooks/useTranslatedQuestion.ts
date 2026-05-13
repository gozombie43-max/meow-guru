/* eslint-disable react-hooks/set-state-in-effect */
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
  const [displayedQuestion, setDisplayedQuestion] = useState(currentQ?.question ?? "");
  const [displayedOptions, setDisplayedOptions] = useState<string[]>(currentQ?.options ?? []);

  useEffect(() => {
    if (!currentQ) {
      setDisplayedQuestion("");
      setDisplayedOptions([]);
      return;
    }

    const question = currentQ.question ?? "";
    const options = currentQ.options ?? [];

    if (activeLang === "en" || skipTranslation) {
      setDisplayedQuestion(question);
      setDisplayedOptions(options);
      return;
    }

    let cancelled = false;
    const allTexts = [question, ...options];

    translate(allTexts, activeLang).then((translated) => {
      if (cancelled) return;
      setDisplayedQuestion(translated[0] ?? question);
      setDisplayedOptions(translated.slice(1));
    });

    return () => {
      cancelled = true;
    };
  }, [activeLang, currentQ, skipTranslation, translate]);

  return {
    activeLang,
    setActiveLang,
    isTranslating,
    displayedQuestion,
    displayedOptions,
  };
}
