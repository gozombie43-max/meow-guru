"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Languages } from "lucide-react";
import { CATEGORIES, TOPICS } from "./topic-data";

const config = {
  subjectId: "english",
  label: "English",
  icon: Languages,
  topics: TOPICS.map((topic) => ({ ...topic, routeBase: `/english/${topic.slug}` })),
  categories: CATEGORIES,
  mobileSearchPlaceholder: "Search topics",
};

export default function EnglishHubClient() {
  const { data } = useTopicQuestionTotals("english");

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
