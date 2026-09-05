"use client";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Languages } from "lucide-react";
import styles from "./english.module.css";
import { CATEGORIES,PRACTICE_MODES,PRIORITY_CONFIG,STUDY_MODE_TOPICS,TOPICS } from "./topic-data";

const config = {
  subjectId: "english", label: "English", icon: Languages, topics: TOPICS.map(topic => ({ ...topic, routeBase: `/english/${topic.slug}` })),
  categories: CATEGORIES, priorityConfig: PRIORITY_CONFIG, practiceModes: PRACTICE_MODES,
  studyModeTopics: STUDY_MODE_TOPICS, styles,
  notesLabel: "Vocabulary & Rules Bank", searchPlaceholder: "Search topics, grammar, rules... (⌘K)", mobileSearchPlaceholder: "Search english topics…",
};
export default function EnglishHubClient() { return <SubjectHub config={config} />; }
