"use client";

import QuizEngine from "@/components/quiz-engine/QuizEngine";
import { englishConfig } from "@/components/quiz-engine/subjects/english";

export default function EnglishQuizEngine(props: {
  title: string;
  slug: string;
  routeBase?: string;
  presentation?: "default" | "ios-dark" | "ios-light" | "mac-dark" | "mac-light";
}) {
  return <QuizEngine subjectConfig={englishConfig} {...props} />;
}
