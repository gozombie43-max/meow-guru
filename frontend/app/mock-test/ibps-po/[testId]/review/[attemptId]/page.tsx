import ReviewEngine from "../../../../_shared/ReviewEngine";

export default function Page({ params }: { params: { testId: string; attemptId: string } }) {
  return <ReviewEngine examSlug="ibps-po" testId={params.testId} attemptId={params.attemptId} />;
}
