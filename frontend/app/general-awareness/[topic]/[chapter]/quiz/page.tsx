import { notFound } from "next/navigation";
import QuizRouteShell from "@/components/quiz-engine/QuizRouteShell";
import GeneralAwarenessQuizEngine from "../../../_shared/quiz-engine";
import {
  getGeneralAwarenessChapter,
  getGeneralAwarenessChapterParams,
  getGeneralAwarenessTopicGroup,
} from "@/lib/general-awareness-topic-groups";

export function generateStaticParams() {
  return getGeneralAwarenessChapterParams();
}

export default async function Page({
  params,
}: {
  params: Promise<{ topic: string; chapter: string }>;
}) {
  const { topic: groupSlug, chapter: chapterSlug } = await params;
  const group = getGeneralAwarenessTopicGroup(groupSlug);
  const chapter = getGeneralAwarenessChapter(groupSlug, chapterSlug);
  if (!group || !chapter) notFound();

  return (
    <QuizRouteShell>
      <GeneralAwarenessQuizEngine
        title={chapter.title}
        slug={chapter.slug}
        questionTopic={chapter.title}
        routeBase={`/general-awareness/${group.slug}/${chapter.slug}`}
      />
    </QuizRouteShell>
  );
}
