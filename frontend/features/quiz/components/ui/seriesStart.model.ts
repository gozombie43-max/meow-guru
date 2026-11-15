import {
  Compass,
  FileQuestion,
  Sparkles,
  Zap,
  Flame,
  Shuffle,
  BookOpenCheck,
  type LucideIcon,
} from "lucide-react";
import { SubjectConfig, ClassificationGroup, QuizMode } from "@/features/quiz/model/types";

export const MODE_DETAILS: Record<
  string,
  { label: string; sub: string; icon: LucideIcon; badge: string }
> = {
  concept: {
    label: "PYQ",
    sub: "Previous year exam questions organized by concept",
    icon: FileQuestion,
    badge: "PYQ",
  },
  formula: {
    label: "CareerWill",
    sub: "Core pattern, vocabulary, and formula shortcuts practice",
    icon: BookOpenCheck,
    badge: "CareerWill",
  },
  mixed: {
    label: "PW",
    sub: "Comprehensive mixture of all topic patterns",
    icon: Shuffle,
    badge: "PW",
  },
  "ai-challenge": {
    label: "Selection Way",
    sub: "Speed-focused adaptive assessment test",
    icon: Zap,
    badge: "Selection Way",
  },
  easy: {
    label: "Topic Mix",
    sub: "Foundation & standard difficulty patterns",
    icon: Compass,
    badge: "Topic Mix",
  },
  "topic-mix": {
    label: "Topic Mix",
    sub: "Foundation & standard difficulty patterns",
    icon: Compass,
    badge: "Topic Mix",
  },
  hard: {
    label: "Tier 2",
    sub: "Advanced multi-step problems & high-tier patterns",
    icon: Flame,
    badge: "Tier 2",
  },
  "study-mode": {
    label: "Study Mode",
    sub: "Interactive study deck and vocabulary practice",
    icon: Sparkles,
    badge: "Study Mode",
  },
};

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export interface MacOsQuizStartStudioProps {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  mode?: QuizMode;
  groups: ClassificationGroup[];
  examFilter: string;
  examOptions: string[];
  selected: Set<string>;
  conceptCount: number;
  questionCount: number;
  search?: string;
  selectedLetters?: Set<string>;
  onToggleLetter?: (letter: string) => void;
  onSelectAllLetters?: () => void;
  letterCounts?: Record<string, number>;
  onExamChange: (exam: string) => void;
  onSearchChange?: (search: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
  isLoading?: boolean;
  groupingStatus?: "ready" | "processing" | "failed" | "empty";
}

export type IosQuizStartMobileProps = MacOsQuizStartStudioProps;
