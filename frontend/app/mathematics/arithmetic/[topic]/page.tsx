import { notFound } from "next/navigation";
import MathematicsTopicPage from "../../_shared/topic-page";
import { QUIZ_TREE } from "@/lib/quiz-constants";

const ARITHMETIC_TOPICS = [
  "averages",
  "discount",
  "interest",
  "mixture-and-alligation",
  "partnership",
  "percentages",
  "profit-and-loss",
  "ratio-and-proportion",
  "square-roots",
  "time-and-distance",
  "time-and-work",
] as const;

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
