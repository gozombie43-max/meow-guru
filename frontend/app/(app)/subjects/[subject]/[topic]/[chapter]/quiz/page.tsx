import { notFound } from 'next/navigation';
import QuizRouteShell from '@/features/quiz/components/QuizRouteShell';
import JamQuiz from '@/components/JamQuiz';
import { JAM_SUBJECT } from '@/lib/exam-mode';
import { getJamChapterGroup } from '@/lib/jam-chapters';

export default async function Page({ params }: { params: Promise<{ subject: string; topic: string; chapter: string }> }) {
  const { subject, topic, chapter } = await params;
  if (subject !== JAM_SUBJECT || !getJamChapterGroup(topic)?.topics.some(item => item.slug === chapter)) notFound();
  return <QuizRouteShell><JamQuiz slug={topic} chapterSlug={chapter} /></QuizRouteShell>;
}
