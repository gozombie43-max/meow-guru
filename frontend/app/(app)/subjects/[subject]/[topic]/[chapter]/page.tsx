import { notFound } from 'next/navigation';
import SubjectTopicPage from '@/features/quiz/components/SubjectTopicPage';
import { JAM_SUBJECT, jamSectionHref } from '@/lib/exam-mode';
import { getJamChapterGroup } from '@/lib/jam-chapters';

export default async function Page({ params }: { params: Promise<{ subject: string; topic: string; chapter: string }> }) {
  const { subject, topic, chapter: slug } = await params;
  const group = getJamChapterGroup(topic);
  const chapter = group?.topics.find(item => item.slug === slug);
  if (subject !== JAM_SUBJECT || !group || !chapter) notFound();
  return <SubjectTopicPage subject={JAM_SUBJECT} title={chapter.title} slug={chapter.slug} questionTopic={chapter.title} routeBase={`${jamSectionHref(topic)}/${chapter.slug}`} backHref={jamSectionHref(topic)} eyebrow={group.label} bannerHref="/resource" bannerSubtitle="IIT JAM Physics notes and revision" />;
}
