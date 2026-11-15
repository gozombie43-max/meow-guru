import type { LucideIcon } from "lucide-react";

export interface HubTopic {
  id: number;
  name: string;
  slug: string;
  routeBase: string;
  questionTopic?: string;
  subtopics: string[];
  priority: string;
  questions: string;
  icon: LucideIcon;
  color: string;
  description: string;
  expectedMarks: string;
}

export interface TopicMobileDetail {
  color: string;
  questionCount?: number;
  userSolved?: number;
  progress?: number;
}

export interface SubjectHubConfig {
  subjectId: string;
  label: string;
  icon: LucideIcon;
  topics: HubTopic[];
  categories: readonly { id: string; label: string; icon: LucideIcon }[];
  styles?: Record<string, string>;
  mobileTopicDetails?: Record<string, TopicMobileDetail>;
  totalsPending?: boolean;
  progressPending?: boolean;
  mobileSearchPlaceholder: string;
  getChapterGroup?: (topicSlug: string) => {
    slug: string;
    label: string;
    topics: readonly { rank: number; title: string; slug: string; priority: string }[];
  } | null;
  chapterBasePrefix?: string;
}
