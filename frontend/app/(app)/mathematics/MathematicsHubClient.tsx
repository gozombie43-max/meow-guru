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
    percentages: { color: "#4D92DF", progress: 43 },
    "ratio-and-proportion": { color: "#8D70CD", progress: 28 },
    "profit-and-loss": { color: "#46A58C", progress: 62 },
    "simple-interest": { color: "#C39B4C" },
    "compound-interest": { color: "#B96879" },
    "time-and-work": { color: "#777FD4", progress: 35 },
    "time-and-distance": { color: "#C46F79", progress: 12 },
    algebra: { color: "#9266C9", progress: 67 },
    geometry: { color: "#4AA68F" },
    mensuration: { color: "#40A2C5", progress: 41 },
    trigonometry: { color: "#4DA6B7", progress: 38 },
    "number-system": { color: "#BD9646", progress: 21 },
    averages: { color: "#7FA850", progress: 15 },
    discount: { color: "#C37D4A" },
    "mixture-and-alligation": { color: "#4F93BF", progress: 18 },
    partnership: { color: "#9E67A8" },
    "square-roots": { color: "#4BA4AD", progress: 25 },
    "statistics-probability": { color: "#B56B7F", progress: 30 },
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
      const totalQuestions = data?.totals?.[topicSlug] || 0;
      const mockConfig = config.mobileTopicDetails[topicSlug as keyof typeof config.mobileTopicDetails];
      const realUserSolved = data?.userProgress?.[topicSlug]?.userSolved || 0;
      
      const mockProgress = (mockConfig as any)?.progress as number | undefined;

      const userSolved = realUserSolved > 0 
        ? realUserSolved 
        : mockProgress 
          ? Math.round(totalQuestions * (mockProgress / 100)) 
          : 0;

      const progress = totalQuestions > 0 && realUserSolved > 0 
        ? Math.round((realUserSolved / totalQuestions) * 100) 
        : mockProgress;

      return [
        topicSlug,
        {
          ...mockConfig,
          questionCount: totalQuestions,
          userSolved,
          progress,
        },
      ];
    })
  );
  return <SubjectHub config={{ ...config, mobileTopicDetails }} />;
}
