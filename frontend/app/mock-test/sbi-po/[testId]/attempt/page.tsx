'use client';

import MockTestEngine from "../../../_shared/MockTestEngine";

export default function Page({ params }: { params: { testId: string } }) {
  return <MockTestEngine examSlug="sbi-po" testId={params.testId} />;
}
