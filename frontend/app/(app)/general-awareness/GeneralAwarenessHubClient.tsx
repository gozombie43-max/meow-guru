"use client";
import { useTopicQuestionTotals, type TopicQuestionSnapshot } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { useSubjectTopicDetails } from "@/components/subject-hub/build-topic-details";
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

const resolveGeneralAwarenessSolved = (
  topic: { slug: string; name: string },
  userProgress: TopicQuestionSnapshot["userProgress"]
) => getGeneralAwarenessTopicSolved(topic.slug, userProgress, topic.name);

export default function GeneralAwarenessHubClient() {
  const { data, totalsPending, progressPending } = useTopicQuestionTotals("general-awareness");
  const mobileTopicDetails = useSubjectTopicDetails(TOPICS, data, resolveGeneralAwarenessSolved);

  return (
    <SubjectHub
      config={{ ...config, mobileTopicDetails, totalsPending, progressPending }}
    />
  );
}
