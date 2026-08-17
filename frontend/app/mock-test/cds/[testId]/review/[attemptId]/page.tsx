import ReviewEngine from "../../../../_shared/ReviewEngine";

export default function Page({ params }: { params: { testId: string; attemptId: string } }) {
  return <ReviewEngine examSlug="cds" testId={params.testId} attemptId={params.attemptId} />;
}
