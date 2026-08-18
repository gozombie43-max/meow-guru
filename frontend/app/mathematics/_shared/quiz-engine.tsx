"use client";

import QuizEngine from "@/components/quiz-engine/QuizEngine";
import { mathematicsConfig } from "@/components/quiz-engine/subjects/mathematics";

export default function MathematicsQuizEngine(props: {
  title: string;
  slug: string;
  routeBase?: string;
  presentation?: "default" | "ios-dark" | "ios-light" | "mac-dark" | "mac-light";
}) {
  return <QuizEngine subjectConfig={mathematicsConfig} {...props} />;
}
