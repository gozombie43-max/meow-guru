import TestInstructions from "../../_shared/TestInstructions";
import { resolveExamSlug } from "../../_shared/route-params";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ examSlug: string; testId: string }>;
  searchParams: Promise<{ resume?: string | string[]; retake?: string | string[]; lang?: string | string[] }>;
}) {
  const { examSlug: rawExamSlug, testId } = await params;
  const { resume, retake, lang } = await searchParams;
  const resumeAttemptId = Array.isArray(resume) ? resume[0] : resume;
  const retakeParam = Array.isArray(retake) ? retake[0] : retake;
  const isRetake = retakeParam === '1' || retakeParam === 'true';
  const langParam = Array.isArray(lang) ? lang[0] : lang;
  return (
    <TestInstructions
      examSlug={resolveExamSlug(rawExamSlug)}
      testId={testId}
      resumeAttemptId={resumeAttemptId}
      isRetake={isRetake}
      initialLanguage={langParam}
    />
  );
}
