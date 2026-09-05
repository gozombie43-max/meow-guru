import {
getGeneralAwarenessChapter,
getGeneralAwarenessChapterParams,
getGeneralAwarenessTopicGroup,
} from "@/lib/general-awareness-topic-groups";
import { notFound } from "next/navigation";
import GeneralAwarenessTopicPage from "../../_shared/topic-page";

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
    <GeneralAwarenessTopicPage
      title={chapter.title}
      slug={chapter.slug}
      questionTopic={chapter.title}
      routeBase={`/general-awareness/${group.slug}/${chapter.slug}`}
      backHref={`/general-awareness/${group.slug}`}
      eyebrow={group.label}
    />
  );
}
