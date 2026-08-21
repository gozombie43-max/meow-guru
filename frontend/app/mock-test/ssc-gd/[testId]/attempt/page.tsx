'use client';;
import { use } from "react";

import MockTestEngine from "../../../_shared/MockTestEngine";

export default function Page(props: { params: Promise<{ testId: string }> }) {
  const params = use(props.params);
  return <MockTestEngine examSlug="ssc-gd" testId={params.testId} />;
}
