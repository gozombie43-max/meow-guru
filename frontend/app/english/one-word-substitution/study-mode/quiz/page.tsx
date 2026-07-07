import { Suspense } from "react";
import StudyModeQuizEngine from "./quiz-engine";

function QuizLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#181613] text-[#c9bfa9]">
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
