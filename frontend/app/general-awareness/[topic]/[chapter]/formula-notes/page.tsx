import { notFound } from "next/navigation";
import FormulaNotesPage from "../../../../mathematics/_shared/formula-notes-page";
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
    <FormulaNotesPage
      subject={`General Awareness · ${group.label}`}
      topic={chapter.slug}
      topicLabel={chapter.title}
    />
  );
}
