"use client";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Brain } from "lucide-react";
import { CATEGORIES,PRACTICE_MODES,PRIORITY_CONFIG,TOPICS } from "./topic-data";

const config = {
  subjectId: "reasoning", label: "Reasoning", icon: Brain, topics: TOPICS.map(topic => ({ ...topic, routeBase: `/reasoning/${topic.slug}` })),
  categories: CATEGORIES, priorityConfig: PRIORITY_CONFIG, practiceModes: PRACTICE_MODES,
  
  notesLabel: "Formula & Tricks Bank", searchPlaceholder: "Search topics, subtopics, rules... (⌘K)", mobileSearchPlaceholder: "Search topics…",
};
export default function ReasoningHubClient() { return <SubjectHub config={config} />; }
