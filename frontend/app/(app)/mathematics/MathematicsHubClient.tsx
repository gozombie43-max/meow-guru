"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Calculator } from "lucide-react";
import { CATEGORIES,PRACTICE_MODES,PRIORITY_CONFIG,TOPICS } from "./topic-data";

const config = {
  subjectId: "mathematics", label: "Mathematics", icon: Calculator, topics: TOPICS,
  categories: CATEGORIES, priorityConfig: PRIORITY_CONFIG, practiceModes: PRACTICE_MODES,
  
  mobileAppearance: "oled" as const,
  mobileTopicDetails: {
    mensuration: { color: "#57b4af" },
    trigonometry: { color: "#61adca" },
    "number-system": { color: "#c5ac64" },
    averages: { color: "#9dbb72" },
    discount: { color: "#d99565" },
    "mixture-and-alligation": { color: "#68a8d3" },
    partnership: { color: "#bf86c4" },
    "square-roots": { color: "#67bbc4" },
    "statistics-probability": { color: "#d38f9f" },
    percentages: { color: "#4799e8" },
    "ratio-and-proportion": { color: "#9b7cdb" },
    "profit-and-loss": { color: "#42b6a2" },
    "simple-interest": { color: "#d7a34b" },
    "compound-interest": { color: "#dd727c" },
    "time-and-work": { color: "#8583da" },
    "time-and-distance": { color: "#d87394" },
    algebra: { color: "#ad85d8" },
    geometry: { color: "#42b6a2" },
  },
  notesLabel: "Formula & Tricks Bank", searchPlaceholder: "Search math topics, formulas, rules... (⌘K)", mobileSearchPlaceholder: "Search math topics…",
};
export default function MathematicsHubClient() {
  const { data } = useTopicQuestionTotals();
  const mobileTopicDetails = Object.fromEntries(TOPICS.map(topic => [topic.slug, {
    ...config.mobileTopicDetails[topic.slug as keyof typeof config.mobileTopicDetails],
    questionCount: data?.totals[topic.slug],
  }]));
  return <SubjectHub config={{ ...config, mobileTopicDetails }} />;
}
