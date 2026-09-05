"use client";
import StudyModeComparisonQuizEngine from "@/app/(app)/english/_shared/StudyModeComparisonQuizEngine";
import type { StudyModeComparisonConfig } from "@/app/(app)/english/_shared/StudyModeComparisonQuizEngine";

const DEMO_CARD = {
  id: "demo",
  word: "Abandon",
  meanings: [
    {
      pos: "v.",
      definition: "To leave or give up completely without intent to return.",
      translation: "ত্যাগ করা / সম্পূর্ণভাবে পরিত্যাগ করা",
    },
    {
      pos: "n.",
      definition: "A complete lack of restraint or inhibition.",
      translation: "উচ্ছৃঙ্খলতা / বেপরোয়া ভাব",
    },
  ],
  primaryItems: [
    { word: "Desert", translation: "পরিত্যাগ করা" },
    { word: "Forsake", translation: "ত্যাগ করা" },
    { word: "Relinquish", translation: "ছেড়ে দেওয়া" },
    { word: "Leave", translation: "ছেড়ে যাওয়া" },
    { word: "Dereliction", translation: "অবহেলা" },
    { word: "Discontinue", translation: "বন্ধ করা" },
    { word: "Unrestraint", translation: "অসংযম" },
  ],
  secondaryItems: [
    { word: "Retain", translation: "ধরে রাখা" },
    { word: "Continue", translation: "চালিয়ে যাওয়া" },
    { word: "Keep", translation: "রাখা" },
    { word: "Adopt", translation: "গ্রহণ করা" },
    { word: "Constraint", translation: "সংযম" },
  ],
};

const config: StudyModeComparisonConfig = {
  topic: "synonyms-antonyms",
  primaryField: "synonyms",
  secondaryField: "antonyms",
  primaryLabel: "Synonyms",
  secondaryLabel: "Antonyms",
  primaryTitle: "SYNONYMS",
  secondaryTitle: "ANTONYMS",
  primaryEmptyLabel: "No synonyms found",
  secondaryEmptyLabel: "No antonyms found",
  demoCard: DEMO_CARD,
};

export default function StudyModeQuizEngine() {
  return <StudyModeComparisonQuizEngine config={config} />;
}
