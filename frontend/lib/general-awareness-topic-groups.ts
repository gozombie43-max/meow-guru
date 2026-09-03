import { GEOGRAPHY_TOPICS } from "./geography-topics";
import {
  ANCIENT_HISTORY_TOPICS,
  MEDIEVAL_HISTORY_TOPICS,
  MODERN_HISTORY_TOPICS,
} from "./history-topics";
import {
  BIOLOGY_TOPICS,
  CHEMISTRY_TOPICS,
  ECONOMY_TOPICS,
  PHYSICS_TOPICS,
  STATIC_GK_TOPICS,
} from "./science-economy-static-topics";
import type { RankedTopicGroup } from "./ranked-topic-groups";
import { POLITY_TOPICS } from "./polity-topics";

export const GENERAL_AWARENESS_TOPIC_GROUPS: Record<string, RankedTopicGroup> = {
  geography: {
    slug: "geography",
    label: "Geography",
    eyebrow: "SSC Geography",
    description: "Start with the highest-weightage chapters. Tap any chapter to open its study hub.",
    metricLabel: "Weightage",
    filters: ["Very High", "High", "Medium"],
    topics: GEOGRAPHY_TOPICS.map(({ rank, title, slug, weightage }) => ({
      rank,
      title,
      slug,
      priority: weightage,
    })),
  },
  polity: {
    slug: "polity",
    label: "Polity & Constitution",
    eyebrow: "SSC & Railway Polity",
    description: "Prioritize constitutional rights, institutions, Parliament, executive, judiciary, and governance.",
    metricLabel: "Weightage",
    filters: ["High", "Medium", "Lower"],
    topics: POLITY_TOPICS,
  },
  "ancient-history": {
    slug: "ancient-history",
    label: "Ancient History",
    eyebrow: "SSC & Railway History",
    description: "Build the ancient-history foundation in exam-priority order.",
    metricLabel: "Priority",
    filters: ["Core", "High", "Medium"],
    topics: ANCIENT_HISTORY_TOPICS,
  },
  "medieval-history": {
    slug: "medieval-history",
    label: "Medieval History",
    eyebrow: "SSC & Railway History",
    description: "Cover the most tested medieval-history chapters first.",
    metricLabel: "Priority",
    filters: ["Core", "High", "Medium"],
    topics: MEDIEVAL_HISTORY_TOPICS,
  },
  "modern-history": {
    slug: "modern-history",
    label: "Modern History",
    eyebrow: "SSC & Railway History",
    description: "Prioritize the freedom struggle, British rule, and national movement.",
    metricLabel: "Priority",
    filters: ["Core", "High", "Medium"],
    topics: MODERN_HISTORY_TOPICS,
  },
  physics: {
    slug: "physics",
    label: "Physics",
    eyebrow: "SSC & Railway Science",
    description: "Study physics in exam-priority order, from measurements and motion to modern physics.",
    metricLabel: "Priority",
    filters: ["Core", "High", "Medium"],
    topics: PHYSICS_TOPICS,
  },
  chemistry: {
    slug: "chemistry",
    label: "Chemistry",
    eyebrow: "SSC & Railway Science",
    description: "Cover the highest-priority chemistry fundamentals before applied and everyday chemistry.",
    metricLabel: "Priority",
    filters: ["Core", "High", "Medium"],
    topics: CHEMISTRY_TOPICS,
  },
  biology: {
    slug: "biology",
    label: "Biology",
    eyebrow: "SSC & Railway Science",
    description: "Prioritize human biology, health, cells, genetics, plants, animals, and ecology.",
    metricLabel: "Priority",
    filters: ["Core", "High", "Medium"],
    topics: BIOLOGY_TOPICS,
  },
  economy: {
    slug: "economy",
    label: "Economy",
    eyebrow: "SSC & Railway Economy",
    description: "Build from economic fundamentals and banking to trade, markets, schemes, and census.",
    metricLabel: "Priority",
    filters: ["Core", "High", "Medium"],
    topics: ECONOMY_TOPICS,
  },
  "static-gk": {
    slug: "static-gk",
    label: "Static GK",
    eyebrow: "SSC & Railway Static GK",
    description: "Revise high-frequency static facts first, followed by culture, places, institutions, and world facts.",
    metricLabel: "Priority",
    filters: ["Core", "High", "Medium"],
    topics: STATIC_GK_TOPICS,
  },
};

export function getGeneralAwarenessTopicGroup(slug: string) {
  return GENERAL_AWARENESS_TOPIC_GROUPS[slug];
}

export function getGeneralAwarenessChapter(groupSlug: string, chapterSlug: string) {
  return getGeneralAwarenessTopicGroup(groupSlug)?.topics.find(
    (topic) => topic.slug === chapterSlug
  );
}

export function getGeneralAwarenessChapterParams() {
  return Object.values(GENERAL_AWARENESS_TOPIC_GROUPS).flatMap((group) =>
    group.topics.map((topic) => ({ topic: group.slug, chapter: topic.slug }))
  );
}
