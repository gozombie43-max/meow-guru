import ReviewEngine from "../../../../_shared/ReviewEngine";

export default async function Page(props: { params: Promise<{ testId: string; attemptId: string }> }) {
  const params = await props.params;
  return <ReviewEngine examSlug="sbi-clerk" testId={params.testId} attemptId={params.attemptId} />;
}
