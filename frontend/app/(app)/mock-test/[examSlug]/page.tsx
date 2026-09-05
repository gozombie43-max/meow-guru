import ExamLandingPage from "../_shared/ExamLandingPage";
import { resolveExamSlug } from "../_shared/route-params";

export default async function Page({
  params,
}: {
  params: Promise<{ examSlug: string }>;
}) {
  const { examSlug: rawExamSlug } = await params;
  return <ExamLandingPage examSlug={resolveExamSlug(rawExamSlug)} />;
}
