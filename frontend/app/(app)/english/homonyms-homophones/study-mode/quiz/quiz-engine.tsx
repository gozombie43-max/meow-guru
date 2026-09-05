"use client";

import StudyModeComparisonQuizEngine,{
type StudyModeComparisonConfig,
} from "@/app/(app)/english/_shared/StudyModeComparisonQuizEngine";

const config: StudyModeComparisonConfig = {
  topic: "homonyms-homophones",
  primaryField: "homophones",
  secondaryField: "homonyms",
  primaryLabel: "Homophones",
  secondaryLabel: "Homonyms",
  primaryTitle: "HOMOPHONES",
  secondaryTitle: "HOMONYMS",
  primaryEmptyLabel: "No documented homophones",
  secondaryEmptyLabel: "No documented homonyms",
  demoCard: {
    id: "demo",
    word: "Accept",
    meanings: [
      {
        pos: "v.",
        definition: "To consent to receive or undertake something offered.",
        translation: "গ্রহণ করা / সম্মত হওয়া",
      },
    ],
    primaryItems: [{ word: "Except", translation: "ব্যতীত / ছাড়া" }],
    secondaryItems: [],
  },
};

export default function StudyModeQuizEngine() {
  return <StudyModeComparisonQuizEngine config={config} />;
}
