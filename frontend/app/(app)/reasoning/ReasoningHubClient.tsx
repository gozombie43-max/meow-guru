"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Brain } from "lucide-react";
import { CATEGORIES, PRACTICE_MODES, PRIORITY_CONFIG, TOPICS } from "./topic-data";

const config = {
  mobileAppearance: "oled" as const,
  subjectId: "reasoning",
  label: "Reasoning",
  icon: Brain,
  topics: TOPICS.map((topic) => ({ ...topic, routeBase: `/reasoning/${topic.slug}` })),
  categories: CATEGORIES,
  priorityConfig: PRIORITY_CONFIG,
  practiceModes: PRACTICE_MODES,
  notesLabel: "Formula & Tricks Bank",
  searchPlaceholder: "Search topics, subtopics, rules... (⌘K)",
  mobileSearchPlaceholder: "Search topics…",
};

export default function ReasoningHubClient() {
  const { data } = useTopicQuestionTotals("reasoning");

  const mobileTopicDetails = Object.fromEntries(
    TOPICS.map((topic) => {
      const topicSlug = topic.slug;
      const totalQuestions = data?.totals?.[topicSlug] || 0;
      const userSolved = data?.userProgress?.[topicSlug]?.userSolved || 0;

      const progress = totalQuestions > 0
        ? Math.round((userSolved / totalQuestions) * 100)
        : 0;

      return [
        topicSlug,
        {
          color: topic.color,
          questionCount: totalQuestions,
          userSolved,
          progress,
        },
      ];
    })
  );

  return <SubjectHub config={{ ...config, mobileTopicDetails }} />;
}
