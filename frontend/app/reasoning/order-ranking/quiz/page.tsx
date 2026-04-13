"use client";

import { Suspense } from "react";
import QuizEngine from "./quiz-engine";

function QuizLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-slate-500 text-lg">Loading quiz...</div>
    </div>
  );
}

export default function QuizPage() {
  return (
    <Suspense fallback={<QuizLoading />}>
      <QuizEngine />
    </Suspense>
  );
}
