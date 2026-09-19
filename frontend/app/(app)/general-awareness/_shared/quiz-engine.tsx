"use client";

import QuizEngine from "@/features/quiz/components/QuizEngine";
import { generalAwarenessConfig } from "@/features/quiz/components/subjects/general-awareness";

export default function GeneralAwarenessQuizEngine(props: {
  title: string;
  slug: string;
  questionTopic?: string;
  routeBase?: string;
  presentation?: "default" | "ios-dark" | "ios-light" | "mac-dark" | "mac-light";
}) {
  return <QuizEngine subjectConfig={generalAwarenessConfig} {...props} />;
}
