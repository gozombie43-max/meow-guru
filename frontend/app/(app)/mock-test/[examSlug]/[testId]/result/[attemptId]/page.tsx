import ResultReport from "../../../../_shared/ResultReport";
import { resolveExamSlug } from "../../../../_shared/route-params";

export default async function Page({
  params,
}: {
  params: Promise<{ examSlug: string; testId: string; attemptId: string }>;
}) {
  const { examSlug: rawExamSlug, testId, attemptId } = await params;
  return (
    <ResultReport
      examSlug={resolveExamSlug(rawExamSlug)}
      testId={testId}
      attemptId={attemptId}
    />
  );
}
