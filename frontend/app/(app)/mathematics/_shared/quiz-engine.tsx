"use client";

import QuizEngine from "@/features/quiz/components/QuizEngine";
import { mathematicsConfig } from "@/features/quiz/components/subjects/mathematics";

export default function MathematicsQuizEngine(props: {
  title: string;
  slug: string;
  routeBase?: string;
  presentation?: "default" | "ios-dark" | "ios-light" | "mac-dark" | "mac-light";
}) {
  return <QuizEngine subjectConfig={mathematicsConfig} {...props} />;
}
