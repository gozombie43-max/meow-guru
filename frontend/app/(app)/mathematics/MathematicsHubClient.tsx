"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Calculator } from "lucide-react";
import { CATEGORIES, PRACTICE_MODES, PRIORITY_CONFIG, TOPICS } from "./topic-data";

const config = {
  subjectId: "mathematics",
  label: "Mathematics",
  icon: Calculator,
  topics: TOPICS,
  categories: CATEGORIES,
  priorityConfig: PRIORITY_CONFIG,
  practiceModes: PRACTICE_MODES,
  mobileAppearance: "oled" as const,
  mobileTopicDetails: {
    percentages: { color: "#4583C7", progress: 43 },
    "ratio-and-proportion": { color: "#8168B8", progress: 28 },
    "profit-and-loss": { color: "#439681", progress: 62 },
    "simple-interest": { color: "#B38F48" },
    "compound-interest": { color: "#A96270" },
    "time-and-work": { color: "#6E75C2", progress: 35 },
    "time-and-distance": { color: "#B26770", progress: 12 },
    algebra: { color: "#845EB5", progress: 67 },
    geometry: { color: "#459682" },
    mensuration: { color: "#3D91B0", progress: 41 },
    trigonometry: { color: "#4796A5", progress: 38 },
    "number-system": { color: "#AC8A44", progress: 21 },
    averages: { color: "#75984D", progress: 15 },
    discount: { color: "#B07245" },
    "mixture-and-alligation": { color: "#4B84AB", progress: 18 },
    partnership: { color: "#8E6096" },
    "square-roots": { color: "#47949B", progress: 25 },
    "statistics-probability": { color: "#A46373", progress: 30 },
  },
  notesLabel: "Formula & Tricks Bank",
  searchPlaceholder: "Search math topics, formulas, rules... (⌘K)",
  mobileSearchPlaceholder: "Search mathematics topics...",
};

export default function MathematicsHubClient() {
  const { data } = useTopicQuestionTotals();
  const mobileTopicDetails = Object.fromEntries(
    TOPICS.map((topic) => [
      topic.slug,
      {
        ...config.mobileTopicDetails[topic.slug as keyof typeof config.mobileTopicDetails],
        questionCount: data?.totals[topic.slug],
      },
    ])
  );
  return <SubjectHub config={{ ...config, mobileTopicDetails }} />;
}
