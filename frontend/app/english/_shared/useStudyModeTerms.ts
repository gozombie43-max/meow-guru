"use client";

import { useEffect, useState } from "react";
import { fetchQuestions, type Question as ApiQuestion } from "@/lib/api/questions";

type StudyModeMeaning = {
  definition?: string;
  translation?: string;
};

type StudyModeEntry = Partial<ApiQuestion> & {
  word?: string;
  meanings?: StudyModeMeaning[];
  prompt?: string;
  phrase?: string;
  answer?: string;
  [key: string]: unknown;
};

export type StudyModeTermCard = {
  id: string;
  prompt: string;
  answer: string;
  definitionTranslation?: string;
  answerTranslation?: string;
  label?: string;
};

const PROMPT_FIELDS = [
  "prompt",
  "phrase",
  "question",
  "definition",
  "meaning",
  "clue",
];

function getFirstString(entry: unknown, keys: string[]) {
  if (!entry || typeof entry !== "object") return "";
  const record = entry as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function normalizeStudyModeTerm(
  entry: StudyModeEntry,
  index: number
): StudyModeTermCard | null {
  const promptFromMeaning = Array.isArray(entry.meanings)
    ? entry.meanings
        .map((meaning) => String(meaning?.definition ?? "").trim())
        .find(Boolean) ?? ""
    : "";
  const prompt = getFirstString(entry, PROMPT_FIELDS) || promptFromMeaning;
  const answer = String(
    entry.word || entry.correctAnswer || entry.answer || entry.solution || ""
  ).trim();

  if (!prompt || !answer) return null;

  const definitionTranslation = Array.isArray(entry.meanings)
    ? entry.meanings
        .map((meaning) => String(meaning?.translation ?? "").trim())
        .find(Boolean)
    : undefined;
  const answerTranslation = getFirstString(entry, [
    "answerTranslation",
    "wordTranslation",
    "translation",
  ]);
  const rawLabel = entry.concept ? String(entry.concept).trim() : "General";
  const label =
    rawLabel.toLowerCase() === "one-word substitution" ? "General" : rawLabel;

  return {
    id: String(entry.id ?? index + 1),
    prompt,
    answer,
    definitionTranslation,
    answerTranslation,
    label,
  };
}

export function useStudyModeTerms(
  topic: string,
  fallbackCards: StudyModeTermCard[]
) {
  const [cards, setCards] = useState<StudyModeTermCard[]>([]);

  useEffect(() => {
    let active = true;
    fetchQuestions({ subject: "english", topic, questionType: "study-mode" })
      .then((data) => {
        if (!active) return;
        const normalized = data
          .map((entry, index) => normalizeStudyModeTerm(entry as StudyModeEntry, index))
          .filter((card): card is StudyModeTermCard => card !== null);
        setCards(normalized.length > 0 ? normalized : fallbackCards);
      })
      .catch(() => {
        if (active) setCards(fallbackCards);
      });

    return () => {
      active = false;
    };
  }, [fallbackCards, topic]);

  return cards.length > 0 ? cards : fallbackCards;
}
