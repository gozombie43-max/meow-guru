import ResultReport from "../../../../_shared/ResultReport";

export default async function Page(props: { params: Promise<{ testId: string; attemptId: string }> }) {
  const params = await props.params;
  return <ResultReport examSlug="ssc-chsl" testId={params.testId} attemptId={params.attemptId} />;
}
