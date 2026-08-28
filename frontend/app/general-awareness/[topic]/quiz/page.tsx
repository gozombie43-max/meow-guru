import { notFound } from "next/navigation";
import QuizRouteShell from "@/components/quiz-engine/QuizRouteShell";
import GeneralAwarenessQuizEngine from "../../_shared/quiz-engine";
import { QUIZ_TREE } from "@/lib/quiz-constants";

export function generateStaticParams() {
  return Object.keys(QUIZ_TREE["general-awareness"].topics).map((topic) => ({ topic }));
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const config = QUIZ_TREE["general-awareness"].topics[topic];
  if (!config) notFound();
  return (
    <QuizRouteShell>
      <GeneralAwarenessQuizEngine title={config.label} slug={topic} />
    </QuizRouteShell>
  );
}
