import QuizRouteShell from "@/components/quiz-engine/QuizRouteShell";
import { mathematicsTopicsForRoute } from "@/lib/mathematics-topics";
import { QUIZ_TREE } from "@/lib/quiz-constants";
import { notFound } from "next/navigation";
import MathematicsQuizEngine from "../../../_shared/quiz-engine";

const ADVANCE_TOPICS = mathematicsTopicsForRoute("advance");

export function generateStaticParams() {
  return ADVANCE_TOPICS.map((topic) => ({ topic }));
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!ADVANCE_TOPICS.includes(topic as (typeof ADVANCE_TOPICS)[number])) notFound();
  const config = QUIZ_TREE.mathematics.topics[topic];
  if (!config) notFound();
  return (
    <QuizRouteShell>
      <MathematicsQuizEngine
        title={config.label}
        slug={topic}
        routeBase={`/mathematics/advance/${topic}`}
      />
    </QuizRouteShell>
  );
}
