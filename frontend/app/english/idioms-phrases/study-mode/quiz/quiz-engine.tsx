"use client";

import StudyModeComparisonQuizEngine, {
  type StudyModeComparisonConfig,
} from "@/app/english/_shared/StudyModeComparisonQuizEngine";

const config: StudyModeComparisonConfig = {
  topic: "idioms-phrases",
  primaryField: "synonyms",
  secondaryField: "antonyms",
  primaryLabel: "Examples",
  secondaryLabel: "Related",
  primaryTitle: "EXAMPLES",
  secondaryTitle: "RELATED",
  primaryEmptyLabel: "No documented synonyms",
  secondaryEmptyLabel: "No documented antonyms",
  demoCard: {
    id: "demo",
    word: "A blessing in disguise",
    meanings: [
      {
        pos: "idiom",
        definition: "A good thing that seemed bad at first.",
        translation: "শাপে বর",
      },
    ],
    primaryItems: [
      {
        word: "Losing that job turned out to be a blessing in disguise because it led me to my current career.",
        translation: "",
      },
    ],
    secondaryItems: [],
  },
};

export default function StudyModeQuizEngine() {
  return <StudyModeComparisonQuizEngine config={config} />;
}
