import { notFound } from "next/navigation";
import GeneralAwarenessTopicPage from "../_shared/topic-page";
import RankedTopicGroupPage from "../_shared/ranked-topic-group-page";
import { getGeneralAwarenessTopicGroup } from "@/lib/general-awareness-topic-groups";
import { QUIZ_TREE } from "@/lib/quiz-constants";

export function generateStaticParams() {
  return Object.keys(QUIZ_TREE["general-awareness"].topics).map((topic) => ({ topic }));
}

export default async function Page({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const config = QUIZ_TREE["general-awareness"].topics[topic];
  if (!config) notFound();
  const group = getGeneralAwarenessTopicGroup(topic);
  if (group) return <RankedTopicGroupPage group={group} />;
  return <GeneralAwarenessTopicPage title={config.label} slug={topic} />;
}
