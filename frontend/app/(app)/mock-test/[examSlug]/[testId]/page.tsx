import TestInstructions from "../../_shared/TestInstructions";
import { resolveExamSlug } from "../../_shared/route-params";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ examSlug: string; testId: string }>;
  searchParams: Promise<{ retake?: string | string[]; lang?: string | string[] }>;
}) {
  const { examSlug: rawExamSlug, testId } = await params;
  const { retake, lang } = await searchParams;
  const retakeParam = Array.isArray(retake) ? retake[0] : retake;
  const isRetake = retakeParam === '1' || retakeParam === 'true';
  const langParam = Array.isArray(lang) ? lang[0] : lang;
  return (
    <TestInstructions
      examSlug={resolveExamSlug(rawExamSlug)}
      testId={testId}
      isRetake={isRetake}
      initialLanguage={langParam}
    />
  );
}
