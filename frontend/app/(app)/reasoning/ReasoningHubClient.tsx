"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { useSubjectTopicDetails } from "@/components/subject-hub/build-topic-details";
import { Brain } from "lucide-react";
import { CATEGORIES, TOPICS } from "./topic-data";

const config = {
  subjectId: "reasoning",
  label: "Reasoning",
  icon: Brain,
  topics: TOPICS.map((topic) => ({ ...topic, routeBase: `/reasoning/${topic.slug}` })),
  categories: CATEGORIES,
  mobileSearchPlaceholder: "Search topics",
};

export default function ReasoningHubClient() {
  const { data, totalsPending, progressPending } = useTopicQuestionTotals("reasoning");
  const mobileTopicDetails = useSubjectTopicDetails(TOPICS, data);

  return (
    <SubjectHub
      config={{ ...config, mobileTopicDetails, totalsPending, progressPending }}
    />
  );
}
