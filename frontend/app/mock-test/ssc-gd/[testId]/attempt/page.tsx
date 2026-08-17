'use client';

import MockTestEngine from "../../../_shared/MockTestEngine";

export default function Page({ params }: { params: { testId: string } }) {
  return <MockTestEngine examSlug="ssc-gd" testId={params.testId} />;
}
