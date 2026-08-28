import TestInstructions from "../../_shared/TestInstructions";
import { resolveExamSlug } from "../../_shared/route-params";

export default async function Page({
  params,
}: {
  params: Promise<{ examSlug: string; testId: string }>;
}) {
  const { examSlug: rawExamSlug, testId } = await params;
  return <TestInstructions examSlug={resolveExamSlug(rawExamSlug)} testId={testId} />;
}
