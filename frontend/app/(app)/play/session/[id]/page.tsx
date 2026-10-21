import TrainingSessionView from "@/components/training/TrainingSessionView";
export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TrainingSessionView id={id} />;
}
