"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Calculator } from "lucide-react";
import { CATEGORIES, PRACTICE_MODES, PRIORITY_CONFIG, TOPICS } from "./topic-data";

interface TopicMobileConfig {
  color: string;
  defaultCount?: number;
  defaultSolved?: number;
  defaultProgress?: number;
}

const config: {
  subjectId: string;
  label: string;
  icon: typeof Calculator;
  topics: typeof TOPICS;
  categories: typeof CATEGORIES;
  priorityConfig: typeof PRIORITY_CONFIG;
  practiceModes: typeof PRACTICE_MODES;
  mobileAppearance: "oled";
  mobileTopicDetails: Record<string, TopicMobileConfig>;
  notesLabel: string;
  searchPlaceholder: string;
  mobileSearchPlaceholder: string;
} = {
  subjectId: "mathematics",
  label: "Mathematics",
  icon: Calculator,
  topics: TOPICS,
  categories: CATEGORIES,
  priorityConfig: PRIORITY_CONFIG,
  practiceModes: PRACTICE_MODES,
  mobileAppearance: "oled" as const,
  mobileTopicDetails: {
    percentages: { color: "#5DA6FF", defaultCount: 705, defaultSolved: 0, defaultProgress: 0 },
    "ratio-and-proportion": { color: "#B06DFF", defaultCount: 284, defaultSolved: 0, defaultProgress: 0 },
    "profit-and-loss": { color: "#45D2B2", defaultCount: 300, defaultSolved: 0, defaultProgress: 0 },
    "simple-interest": { color: "#F3B54A", defaultCount: 0 },
    "compound-interest": { color: "#EE6F9C", defaultCount: 0 },
    "time-and-work": { color: "#7F84FF", defaultCount: 299, defaultSolved: 0, defaultProgress: 0 },
    "time-and-distance": { color: "#EF7C88", defaultCount: 45, defaultSolved: 0, defaultProgress: 0 },
    algebra: { color: "#C374FF", defaultCount: 853, defaultSolved: 0, defaultProgress: 0 },
    geometry: { color: "#42C49F", defaultCount: 0 },
    mensuration: { color: "#33C6F2", defaultCount: 361, defaultSolved: 0, defaultProgress: 0 },
    trigonometry: { color: "#4DA6B7", defaultCount: 240, defaultSolved: 0, defaultProgress: 0 },
    "number-system": { color: "#BD9646", defaultCount: 215, defaultSolved: 0, defaultProgress: 0 },
    averages: { color: "#7FA850", defaultCount: 160, defaultSolved: 0, defaultProgress: 0 },
    discount: { color: "#C37D4A", defaultCount: 0 },
    "mixture-and-alligation": { color: "#4F93BF", defaultCount: 112, defaultSolved: 0, defaultProgress: 0 },
    partnership: { color: "#9E67A8", defaultCount: 0 },
    "square-roots": { color: "#4BA4AD", defaultCount: 125, defaultSolved: 0, defaultProgress: 0 },
    "statistics-probability": { color: "#B56B7F", defaultCount: 182, defaultSolved: 0, defaultProgress: 0 },
    simplification: { color: "#a3e635", defaultCount: 0 },
    "lcm-and-hcf": { color: "#34d399", defaultCount: 0 },
    "problems-on-ages": { color: "#fb923c", defaultCount: 0 },
    "pipes-and-cisterns": { color: "#60a5fa", defaultCount: 0 },
    "calendar-and-clock": { color: "#a78bfa", defaultCount: 0 },
  },
  notesLabel: "Formula & Tricks Bank",
  searchPlaceholder: "Search math topics, formulas, rules... (⌘K)",
  mobileSearchPlaceholder: "Search mathematics topics...",
};

export default function MathematicsHubClient() {
  const { data } = useTopicQuestionTotals();
  const mobileTopicDetails = Object.fromEntries(
    TOPICS.map((topic) => {
      const topicSlug = topic.slug;
      const mockConfig: TopicMobileConfig | undefined = config.mobileTopicDetails[topicSlug];
      const hasApiTotal = Boolean(data?.totals && typeof data.totals[topicSlug] === "number");
      const totalQuestions = hasApiTotal
        ? (data?.totals?.[topicSlug] ?? 0)
        : (mockConfig?.defaultCount ?? 0);

      const hasApiSolved = Boolean(data?.userProgress && typeof data.userProgress[topicSlug]?.userSolved === "number");
      const userSolved = hasApiSolved
        ? (data?.userProgress?.[topicSlug]?.userSolved ?? 0)
        : (mockConfig?.defaultSolved ?? 0);

      const progress = totalQuestions > 0 
        ? Math.round((userSolved / totalQuestions) * 100) 
        : (mockConfig?.defaultProgress ?? 0);

      return [
        topicSlug,
        {
          color: mockConfig?.color ?? topic.color,
          questionCount: totalQuestions,
          userSolved,
          progress,
        },
      ];
    })
  );
  return <SubjectHub config={{ ...config, mobileTopicDetails }} />;
}
