"use client";
import SubjectHub from "@/components/subject-hub/SubjectHub";
import { Calculator } from "lucide-react";
import { CATEGORIES,PRACTICE_MODES,PRIORITY_CONFIG,TOPICS } from "./topic-data";

const config = {
  subjectId: "mathematics", label: "Mathematics", icon: Calculator, topics: TOPICS,
  categories: CATEGORIES, priorityConfig: PRIORITY_CONFIG, practiceModes: PRACTICE_MODES,
  
  notesLabel: "Formula & Tricks Bank", searchPlaceholder: "Search math topics, formulas, rules... (⌘K)", mobileSearchPlaceholder: "Search math topics…",
};
export default function MathematicsHubClient() { return <SubjectHub config={config} />; }
