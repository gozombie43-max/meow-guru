import type { LucideIcon } from "lucide-react";
export interface HubTopic {
  id: number;
  name: string;
  slug: string;
  routeBase: string;
  subtopics: string[];
  priority: string;
  questions: string;
  icon: LucideIcon;
  color: string;
  description: string;
  expectedMarks: string;
}
export interface HubPracticeMode {
  key: string;
  title: string;
  sub: string;
  mode: string;
  icon: LucideIcon;
  color: string;
  gradient: string;
  gradientDark: string;
  border: string;
  borderDark: string;
  shadow: string;
}
export interface SubjectHubConfig {
  subjectId: string;
  label: string;
  icon: LucideIcon;
  topics: HubTopic[];
  categories: readonly { id: string; label: string; icon: LucideIcon }[];
  priorityConfig: Record<
    string,
    { label: string; badgeBg: string; badgeColor: string }
  >;
  practiceModes: readonly HubPracticeMode[];
  studyModeTopics?: Set<string>;
  styles?: Record<string, string>;
  notesLabel: string;
  searchPlaceholder: string;
  mobileSearchPlaceholder: string;
  getChapterGroup?: (topicSlug: string) => {
    slug: string;
    label: string;
    topics: readonly { rank: number; title: string; slug: string; priority: string }[];
  } | null;
  chapterBasePrefix?: string;
}
