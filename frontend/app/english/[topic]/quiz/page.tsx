import { notFound } from "next/navigation";
import QuizRouteShell from "@/components/quiz-engine/QuizRouteShell";
import EnglishQuizEngine from "../../_shared/quiz-engine";
import { QUIZ_TREE } from "@/lib/quiz-constants";

export function generateStaticParams() {
  return Object.keys(QUIZ_TREE.english.topics).map((topic) => ({ topic }));
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const config = QUIZ_TREE.english.topics[topic];
  if (!config) notFound();
  return (
    <QuizRouteShell>
      <EnglishQuizEngine title={config.label} slug={topic} />
    </QuizRouteShell>
  );
}
