import { notFound } from 'next/navigation';
import QuizRouteShell from '@/features/quiz/components/QuizRouteShell';
import JamQuiz from '@/components/JamQuiz';
import { JAM_SECTIONS, JAM_SUBJECT } from '@/lib/exam-mode';
export default async function Page({ params }: { params: Promise<{ subject: string; topic: string }> }) {
  const { subject, topic } = await params;
  if (subject !== JAM_SUBJECT || !JAM_SECTIONS.some(item => item.slug === topic)) notFound();
  return <QuizRouteShell><JamQuiz slug={topic} /></QuizRouteShell>;
}
