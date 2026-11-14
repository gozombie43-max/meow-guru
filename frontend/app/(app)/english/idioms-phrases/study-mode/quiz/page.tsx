import { Suspense } from "react";
import StudyModeQuizEngine from "./quiz-engine";

function QuizLoading() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-meow-bg text-meow-secondary">
      <div className="animate-pulse text-lg">Loading study quiz...</div>
    </div>
  );
}

export default function StudyModeQuizPage() {
  return (
    <Suspense fallback={<QuizLoading />}>
      <StudyModeQuizEngine />
    </Suspense>
  );
}