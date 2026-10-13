import { notFound } from 'next/navigation';
import RankedTopicGroupPage from '@/app/(app)/general-awareness/_shared/ranked-topic-group-page';
import { JAM_SUBJECT, jamSectionHref } from '@/lib/exam-mode';
import { getJamChapterGroup } from '@/lib/jam-chapters';
export default async function Page({ params }: { params: Promise<{ subject: string; topic: string }> }) {
  const { subject, topic } = await params;
  const group = getJamChapterGroup(topic);
  if (subject !== JAM_SUBJECT || !group) notFound();
  return <RankedTopicGroupPage group={group} subject={JAM_SUBJECT} routeBase={jamSectionHref(topic)} backHref="/" backLabel="Home" />;
}
