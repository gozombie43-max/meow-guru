"use client";

import QuizEngine from "@/components/quiz-engine/QuizEngine";
import { reasoningConfig } from "@/components/quiz-engine/subjects/reasoning";

export default function ReasoningQuizEngine(props: {
  title: string;
  slug: string;
  routeBase?: string;
  presentation?: "default" | "ios-dark" | "ios-light" | "mac-dark" | "mac-light";
}) {
  return <QuizEngine subjectConfig={reasoningConfig} {...props} />;
}
