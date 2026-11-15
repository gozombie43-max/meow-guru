"use client";
import { useTopicQuestionTotals } from "@/hooks/useTopicQuestionTotals";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { useSubjectTopicDetails } from "@/components/subject-hub/build-topic-details";
import { Calculator } from "lucide-react";
import { CATEGORIES, TOPICS } from "./topic-data";

const TOPIC_COLORS: Record<string, string> = {
  percentages: "#5DA6FF",
  "ratio-and-proportion": "#B06DFF",
  "profit-and-loss": "#45D2B2",
  "simple-interest": "#F3B54A",
  "compound-interest": "#EE6F9C",
  "time-and-work": "#7F84FF",
  "time-and-distance": "#EF7C88",
  algebra: "#C374FF",
  geometry: "#42C49F",
  mensuration: "#33C6F2",
  trigonometry: "#4DA6B7",
  "number-system": "#BD9646",
  averages: "#7FA850",
  discount: "#C37D4A",
  "mixture-and-alligation": "#4F93BF",
  partnership: "#9E67A8",
  "square-roots": "#4BA4AD",
  "statistics-probability": "#B56B7F",
  simplification: "#a3e635",
  "lcm-and-hcf": "#34d399",
  "problems-on-ages": "#fb923c",
  "pipes-and-cisterns": "#60a5fa",
  "calendar-and-clock": "#a78bfa",
};

const config = {
  subjectId: "mathematics",
  label: "Mathematics",
  icon: Calculator,
  topics: TOPICS,
  categories: CATEGORIES,
  mobileSearchPlaceholder: "Search topics",
};

export default function MathematicsHubClient() {
  const { data, totalsPending, progressPending } = useTopicQuestionTotals();
  const mobileTopicDetails = useSubjectTopicDetails(TOPICS, data, {
    colorOverrides: TOPIC_COLORS,
  });

  return (
    <SubjectHub
      config={{ ...config, mobileTopicDetails, totalsPending, progressPending }}
    />
  );
}
