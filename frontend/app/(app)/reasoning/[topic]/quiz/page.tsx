import QuizRouteShell from "@/components/quiz-engine/QuizRouteShell";
import { QUIZ_TREE } from "@/lib/quiz-constants";
import { notFound } from "next/navigation";
import ReasoningQuizEngine from "../../_shared/quiz-engine";

export function generateStaticParams() {
  return Object.keys(QUIZ_TREE.reasoning.topics).map((topic) => ({ topic }));
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const config = QUIZ_TREE.reasoning.topics[topic];
  if (!config) notFound();
  return (
    <QuizRouteShell>
      <ReasoningQuizEngine title={config.label} slug={topic} />
    </QuizRouteShell>
  );
}
