"use client";

import QuizEngine from "@/features/quiz/components/QuizEngine";
import { reasoningConfig } from "@/features/quiz/components/subjects/reasoning";

export default function ReasoningQuizEngine(props: {
  title: string;
  slug: string;
  routeBase?: string;
  presentation?: "default" | "ios-dark" | "ios-light" | "mac-dark" | "mac-light";
}) {
  return <QuizEngine subjectConfig={reasoningConfig} {...props} />;
}
