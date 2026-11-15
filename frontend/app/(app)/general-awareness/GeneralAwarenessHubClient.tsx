"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Globe, Zap, TrendingUp, CircleDot } from "lucide-react";
import { TOPICS } from "./topic-data";
import { getGeneralAwarenessTopicGroup, getGeneralAwarenessTopicSolved } from "@/lib/general-awareness-topic-groups";

const config = {
  subjectId: "general-awareness",
  label: "General Awareness",
  icon: Globe,
  topics: TOPICS.map((topic) => ({ ...topic, routeBase: `/general-awareness/${topic.slug}` })),
  categories: [
    { id: "very-high", label: "Core", icon: Zap },
    { id: "high", label: "High", icon: TrendingUp },
    { id: "medium", label: "Medium", icon: CircleDot },
  ],
  mobileSearchPlaceholder: "Search topics",
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
      const rawSolved = getGeneralAwarenessTopicSolved(topicSlug, data?.userProgress, topic.name);
      const userSolved = hasApiTotal && totalQuestions > 0 ? Math.min(rawSolved, totalQuestions) : rawSolved;

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
