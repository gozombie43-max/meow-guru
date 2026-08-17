import ResultReport from "../../../../_shared/ResultReport";

export default function Page({ params }: { params: { testId: string; attemptId: string } }) {
  return <ResultReport examSlug="ibps-po" testId={params.testId} attemptId={params.attemptId} />;
}
