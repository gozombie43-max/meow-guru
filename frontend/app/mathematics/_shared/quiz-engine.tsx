"use client";

import type { ComponentType } from "react";
import AlgebraQuizEngineImpl from "../algebra/quiz/quiz-engine.impl";
import GeometryQuizEngineImpl from "../geometry/quiz/quiz-engine.impl";
import TrigonometryQuizEngineImpl from "../trigonometry/quiz/quiz-engine.impl";
import PercentagesQuizEngineImpl from "../arithmetic/percentages/quiz/quiz-engine.impl";

type SupportedMathQuizSlug = "algebra" | "geometry" | "trigonometry" | "percentages";

interface MathematicsQuizEngineProps {
  slug: SupportedMathQuizSlug;
}

const QUIZ_ENGINES: Record<SupportedMathQuizSlug, ComponentType> = {
  algebra: AlgebraQuizEngineImpl,
  geometry: GeometryQuizEngineImpl,
  trigonometry: TrigonometryQuizEngineImpl,
  percentages: PercentagesQuizEngineImpl,
};

export default function MathematicsQuizEngine({ slug }: MathematicsQuizEngineProps) {
  const QuizEngine = QUIZ_ENGINES[slug];
  return <QuizEngine />;
}
