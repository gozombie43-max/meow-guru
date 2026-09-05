import TestInstructions from "../../_shared/TestInstructions";
import { resolveExamSlug } from "../../_shared/route-params";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ examSlug: string; testId: string }>;
  searchParams: Promise<{ resume?: string | string[] }>;
}) {
  const { examSlug: rawExamSlug, testId } = await params;
  const { resume } = await searchParams;
  const resumeAttemptId = Array.isArray(resume) ? resume[0] : resume;
  return (
    <TestInstructions
      examSlug={resolveExamSlug(rawExamSlug)}
      testId={testId}
      resumeAttemptId={resumeAttemptId}
    />
  );
}
