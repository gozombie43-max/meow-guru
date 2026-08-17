import TestInstructions from "../../_shared/TestInstructions";

export default function Page({ params }: { params: { testId: string } }) {
  return <TestInstructions examSlug="cat" testId={params.testId} />;
}
