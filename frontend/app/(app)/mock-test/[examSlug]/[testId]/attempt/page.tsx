import MockTestEngine from "../../../_shared/MockTestEngine";
import { resolveExamSlug } from "../../../_shared/route-params";

export default async function Page({
  params,
}: {
  params: Promise<{ examSlug: string; testId: string }>;
}) {
  const { examSlug: rawExamSlug, testId } = await params;
  return <MockTestEngine examSlug={resolveExamSlug(rawExamSlug)} testId={testId} />;
}
