"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Globe, Zap, TrendingUp, CircleDot } from "lucide-react";
import { TOPICS, PRACTICE_MODES, PRIORITY_BADGE_STYLE } from "./topic-data";
import { getGeneralAwarenessTopicGroup } from "@/lib/general-awareness-topic-groups";

const config = {
  mobileAppearance: "oled" as const,
  subjectId: "general-awareness",
  label: "General Awareness",
  icon: Globe,
  topics: TOPICS.map((topic) => ({ ...topic, routeBase: `/general-awareness/${topic.slug}` })),
  categories: [
    { id: "very-high", label: "Core", icon: Zap },
    { id: "high", label: "High", icon: TrendingUp },
    { id: "medium", label: "Medium", icon: CircleDot },
  ],
  priorityConfig: PRIORITY_BADGE_STYLE,
  practiceModes: PRACTICE_MODES,
  notesLabel: "Facts & Summary Notes",
  searchPlaceholder: "Search topics, chapters... (⌘K)",
  mobileSearchPlaceholder: "Search topics…",
  getChapterGroup: getGeneralAwarenessTopicGroup,
  chapterBasePrefix: "/general-awareness",
};

export default function GeneralAwarenessHubClient() {
  const { data } = useTopicQuestionTotals("general-awareness");

  const mobileTopicDetails = Object.fromEntries(
    TOPICS.map((topic) => {
      const topicSlug = topic.slug;
      const hasApiTotal = Boolean(data?.totals && typeof data.totals[topicSlug] === "number");
      const totalQuestions = hasApiTotal ? (data?.totals?.[topicSlug] ?? 0) : 0;
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
