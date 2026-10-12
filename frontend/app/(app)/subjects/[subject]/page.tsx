import { notFound } from 'next/navigation';
import JamSubjectHub from '@/components/JamSubjectHub';
import { JAM_SUBJECT } from '@/lib/exam-mode';
export default async function Page({ params }: { params: Promise<{ subject: string }> }) {
  const { subject } = await params;
  if (subject !== JAM_SUBJECT) notFound();
  return <JamSubjectHub />;
}
