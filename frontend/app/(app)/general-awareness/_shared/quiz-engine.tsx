"use client";

import QuizEngine from "@/components/quiz-engine/QuizEngine";
import { generalAwarenessConfig } from "@/components/quiz-engine/subjects/general-awareness";

export default function GeneralAwarenessQuizEngine(props: {
  title: string;
  slug: string;
  questionTopic?: string;
  routeBase?: string;
  presentation?: "default" | "ios-dark" | "ios-light" | "mac-dark" | "mac-light";
}) {
  return <QuizEngine subjectConfig={generalAwarenessConfig} {...props} />;
}
