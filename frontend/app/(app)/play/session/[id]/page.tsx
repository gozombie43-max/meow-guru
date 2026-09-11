"use client";
import { use } from "react";
import TrainingSessionView from "@/components/training/TrainingSessionView";
export default function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TrainingSessionView id={id} />;
}
