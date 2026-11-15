"use client";

import { useMemo } from "react";
import type { TopicQuestionSnapshot } from "@/hooks/useTopicQuestionTotals";
import type { HubTopic, TopicMobileDetail } from "./types";

type TopicDetailInput = Pick<HubTopic, "slug" | "name" | "color">;

type SolvedResolver<T extends TopicDetailInput = TopicDetailInput> = (
  topic: T,
  userProgress: TopicQuestionSnapshot["userProgress"]
) => number;

interface TopicDetailsOptions<T extends TopicDetailInput = TopicDetailInput> {
  resolveSolved?: SolvedResolver<T>;
  colorOverrides?: Record<string, string>;
}

const defaultResolveSolved: SolvedResolver = (topic, userProgress) =>
  userProgress?.[topic.slug]?.userSolved || 0;

/** Builds memoized per-topic totals and user progress details for subject hubs. */
export function useSubjectTopicDetails<T extends TopicDetailInput>(
  topics: readonly T[],
  data: TopicQuestionSnapshot | undefined,
  options?: TopicDetailsOptions<T> | SolvedResolver<T>
): Record<string, TopicMobileDetail> {
  const resolveSolved =
    typeof options === "function" ? options : (options?.resolveSolved ?? defaultResolveSolved);
  const colorOverrides = typeof options === "function" ? undefined : options?.colorOverrides;
  const totals = data?.totals;
  const userProgress = data?.userProgress;

  return useMemo(
    () =>
      Object.fromEntries(
        topics.map((topic) => {
          const hasApiTotal = Boolean(totals && typeof totals[topic.slug] === "number");
          const questionCount = hasApiTotal ? (totals?.[topic.slug] ?? 0) : 0;
          const rawSolved = resolveSolved(topic, userProgress);
          const userSolved =
            hasApiTotal && questionCount > 0 ? Math.min(rawSolved, questionCount) : rawSolved;
          const progress =
            questionCount > 0 ? Math.round((userSolved / questionCount) * 100) : 0;

          return [
            topic.slug,
            {
              color: colorOverrides?.[topic.slug] ?? topic.color,
              questionCount,
              userSolved,
              progress,
            },
          ];
        })
      ),
    [topics, totals, userProgress, resolveSolved, colorOverrides]
  );
}
