'use client';

import { useParams } from 'next/navigation';
import ExamLandingPage from '../_shared/ExamLandingPage';

export default function Loading() {
  const { examSlug } = useParams<{ examSlug: string }>();
  return <ExamLandingPage examSlug={examSlug} loadingOnly />;
}
