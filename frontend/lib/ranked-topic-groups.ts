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
