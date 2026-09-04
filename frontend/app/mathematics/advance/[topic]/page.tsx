import { notFound } from "next/navigation";
import MathematicsTopicPage from "../../_shared/topic-page";
import { QUIZ_TREE } from "@/lib/quiz-constants";

const ADVANCE_TOPICS = [
  "algebra",
  "geometry",
  "mensuration",
  "trigonometry",
  "number-system",
] as const;

export function generateStaticParams() {
  return ADVANCE_TOPICS.map((topic) => ({ topic }));
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!ADVANCE_TOPICS.includes(topic as (typeof ADVANCE_TOPICS)[number])) notFound();
  const config = QUIZ_TREE.mathematics.topics[topic];
  if (!config) notFound();
  return (
    <MathematicsTopicPage
      title={config.label}
      slug={topic}
      routeBase={`/mathematics/advance/${topic}`}
    />
  );
}
