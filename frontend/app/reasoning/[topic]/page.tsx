import { notFound } from "next/navigation";
import ReasoningTopicPage from "../_shared/topic-page";
import { QUIZ_TREE } from "@/lib/quiz-constants";

export function generateStaticParams() {
  return Object.keys(QUIZ_TREE.reasoning.topics).map((topic) => ({ topic }));
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const config = QUIZ_TREE.reasoning.topics[topic];
  if (!config) notFound();
  return <ReasoningTopicPage title={config.label} slug={topic} />;
}
