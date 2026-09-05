import { mathematicsTopicsForRoute } from "@/lib/mathematics-topics";
import { QUIZ_TREE } from "@/lib/quiz-constants";
import { notFound } from "next/navigation";
import MathematicsTopicPage from "../../_shared/topic-page";

const ARITHMETIC_TOPICS = mathematicsTopicsForRoute("arithmetic");

export function generateStaticParams() {
  return ARITHMETIC_TOPICS.map((topic) => ({ topic }));
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!ARITHMETIC_TOPICS.includes(topic as (typeof ARITHMETIC_TOPICS)[number])) notFound();
  const config = QUIZ_TREE.mathematics.topics[topic];
  if (!config) notFound();
  return (
    <MathematicsTopicPage
      title={config.label}
      slug={topic}
      routeBase={`/mathematics/arithmetic/${topic}`}
    />
  );
}
