"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { useSubjectTopicDetails } from "@/components/subject-hub/build-topic-details";
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
  const { data, totalsPending, progressPending } = useTopicQuestionTotals("english");
  const mobileTopicDetails = useSubjectTopicDetails(TOPICS, data);

  return (
    <SubjectHub
      config={{ ...config, mobileTopicDetails, totalsPending, progressPending }}
    />
  );
}
