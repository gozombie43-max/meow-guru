export type RankedTopicPriority = "Very High" | "Core" | "High" | "Medium" | "Lower";

export interface RankedTopic {
  readonly rank: number;
  readonly title: string;
  readonly slug: string;
  readonly priority: RankedTopicPriority;
}

export interface RankedTopicGroup {
  readonly slug: string;
  readonly label: string;
  readonly eyebrow: string;
  readonly description: string;
  readonly metricLabel: "Weightage" | "Priority";
  readonly filters: readonly RankedTopicPriority[];
  readonly topics: readonly RankedTopic[];
}

export function toTopicSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
