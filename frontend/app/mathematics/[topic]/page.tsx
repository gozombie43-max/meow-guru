import { notFound } from "next/navigation";
import MathematicsTopicPage from "../_shared/topic-page";
import { QUIZ_TREE } from "@/lib/quiz-constants";

const TOP_LEVEL_TOPICS = [
  "algebra",
  "geometry",
  "mensuration",
  "trigonometry",
  "number-system",
  "statistics-probability",
] as const;

export function generateStaticParams() {
  return TOP_LEVEL_TOPICS.map((topic) => ({ topic }));
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  if (!TOP_LEVEL_TOPICS.includes(topic as (typeof TOP_LEVEL_TOPICS)[number])) notFound();
  const config = QUIZ_TREE.mathematics.topics[topic];
  if (!config) notFound();
  return <MathematicsTopicPage title={config.label} slug={topic} />;
}
