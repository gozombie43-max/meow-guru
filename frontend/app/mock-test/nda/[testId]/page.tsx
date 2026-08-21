import TestInstructions from "../../_shared/TestInstructions";

export default async function Page(props: { params: Promise<{ testId: string }> }) {
  const params = await props.params;
  return <TestInstructions examSlug="nda" testId={params.testId} />;
}
