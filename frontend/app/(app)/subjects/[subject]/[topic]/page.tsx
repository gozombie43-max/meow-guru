import { notFound } from 'next/navigation';
import SubjectTopicPage from '@/features/quiz/components/SubjectTopicPage';
import { JAM_SECTIONS, JAM_SUBJECT, jamSectionHref, jamQuestionTopic } from '@/lib/exam-mode';
export default async function Page({ params }: { params: Promise<{ subject: string; topic: string }> }) {
  const { subject, topic } = await params;
  const section = JAM_SECTIONS.find(item => item.slug === topic);
  if (subject !== JAM_SUBJECT || !section) notFound();
  return <SubjectTopicPage subject={JAM_SUBJECT} title={section.title} slug={topic} questionTopic={jamQuestionTopic(topic)} routeBase={jamSectionHref(topic)} backHref={`/subjects/${JAM_SUBJECT}`} bannerHref="/resource" bannerSubtitle="IIT JAM Physics notes and revision" />;
}
