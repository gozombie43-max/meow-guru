"use client";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Globe } from "lucide-react";
import { TOPICS, PRACTICE_MODES, PRIORITY_BADGE_STYLE } from "./topic-data";
import { getGeneralAwarenessTopicGroup } from "@/lib/general-awareness-topic-groups";

const config = {
  subjectId: "general-awareness",
  label: "General Awareness",
  icon: Globe,
  topics: TOPICS.map(topic => ({ ...topic, routeBase: `/general-awareness/${topic.slug}` })),
  categories: [], // Not used in chapter mode
  priorityConfig: PRIORITY_BADGE_STYLE,
  practiceModes: PRACTICE_MODES,
  notesLabel: "Facts & Summary Notes",
  searchPlaceholder: "Search topics, chapters... (⌘K)",
  mobileSearchPlaceholder: "Search topics…",
  getChapterGroup: getGeneralAwarenessTopicGroup,
  chapterBasePrefix: "/general-awareness",
};

export default function GeneralAwarenessHubClient() {
  return <SubjectHub config={config} />;
}
