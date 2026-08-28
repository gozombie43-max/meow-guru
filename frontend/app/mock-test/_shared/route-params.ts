import { notFound } from "next/navigation";
import { EXAM_SLUGS, type ExamSlug } from "./exam-config";

const EXAM_SLUG_SET = new Set<string>(EXAM_SLUGS);

export function resolveExamSlug(value: string): ExamSlug {
  if (!EXAM_SLUG_SET.has(value)) notFound();
  return value as ExamSlug;
}
