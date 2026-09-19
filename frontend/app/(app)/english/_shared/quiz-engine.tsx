"use client";

import QuizEngine from "@/features/quiz/components/QuizEngine";
import { englishConfig } from "@/features/quiz/components/subjects/english";

export default function EnglishQuizEngine(props: {
  title: string;
  slug: string;
  routeBase?: string;
  presentation?: "default" | "ios-dark" | "ios-light" | "mac-dark" | "mac-light";
}) {
  return <QuizEngine subjectConfig={englishConfig} {...props} />;
}
