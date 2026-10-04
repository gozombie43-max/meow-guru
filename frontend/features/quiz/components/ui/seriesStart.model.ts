

import { Lock, Brain, Puzzle, TrendingUp, ArrowLeftRight, Filter, Users2, Compass, CircleDot, Scale, Calculator, Trophy, FileCheck, HelpCircle, Swords, Shapes, Scissors, FlipHorizontal, Box, Table2, SpellCheck, Heart, Share2, Type, FileQuestion, Sparkles, Zap, Target, Search, Flame, Shuffle, BookOpenCheck, Percent, Divide, Clock, Gauge, Variable, Orbit, Hash, BarChart3, Tag, FlaskConical, Radical, PieChart, Globe, Atom, Languages, Landmark, Coins, BookMarked, MessageSquare, Edit3, FileSpreadsheet, Newspaper, RefreshCw, MessageCircle, Navigation, FileText, Link2, Volume2, Layout, CheckSquare, UserCheck, AlignLeft, type LucideIcon } from "lucide-react";

import { SubjectConfig, ClassificationGroup, QuizMode } from "@/features/quiz/model/types";

export const TOPIC_ICONS: Record<string, LucideIcon> = {
  // Reasoning topics
  "coding-decoding": Lock,
  "syllogism-inferences": Brain,
  "puzzle-seating-arrangement": Puzzle,
  series: TrendingUp,
  analogy: ArrowLeftRight,
  "classification-odd-one-out": Filter,
  "blood-relations": Users2,
  "direction-distance": Compass,
  "venn-diagram": CircleDot,
  inequalities: Scale,
  "mathematical-symbolic-operations": Calculator,
  "order-ranking": Trophy,
  "statement-conclusion": FileCheck,
  "statement-assumptions": HelpCircle,
  "statement-arguments": Swords,
  "problem-solving-critical-thinking": Brain,
  "non-verbal-figures": Shapes,
  "paper-folding-cutting": Scissors,
  "mirror-water-image": FlipHorizontal,
  "cube-dice": Box,
  matrix: Table2,
  "logical-sequence-of-words": SpellCheck,
  "emotional-intelligence": Heart,
  "social-intelligence": Share2,
  "word-building": Type,

  // Mathematics topics
  percentages: Percent,
  "ratio-and-proportion": Divide,
  "profit-and-loss": TrendingUp,
  interest: Landmark,
  "simple-interest": Landmark,
  "compound-interest": Coins,
  "time-and-work": Clock,
  "time-and-distance": Gauge,
  algebra: Variable,
  geometry: Compass,
  mensuration: Box,
  trigonometry: Orbit,
  "number-system": Hash,
  averages: BarChart3,
  discount: Tag,
  "mixture-and-alligation": FlaskConical,
  partnership: Users2,
  "square-roots": Radical,
  "statistics-probability": PieChart,

  // English topics
  "synonyms-antonyms": ArrowLeftRight,
  "one-word-substitution": BookMarked,
  "idioms-phrases": MessageSquare,
  "spot-the-error-error-detection": Search,
  "sentence-correction-improvement": Edit3,
  "cloze-test": FileSpreadsheet,
  "reading-comprehension": Newspaper,
  "active-passive-voice": RefreshCw,
  "direct-indirect-narration": MessageCircle,
  tenses: Clock,
  "subject-verb-agreement": Scale,
  "para-jumbles": Shuffle,
  "fill-in-the-blanks": Puzzle,
  "spelling-misspelled-words": SpellCheck,
  prepositions: Navigation,
  articles: FileText,
  conjunctions: Link2,
  "homonyms-homophones": Volume2,
  "sentence-structure": Layout,
  "para-sentence-completion": CheckSquare,
  pronouns: UserCheck,
  modifiers: Target,
  parallelism: AlignLeft,

  // General Awareness topics
  history: Landmark,
  polity: Scale,
  geography: Globe,
  "general-science": Atom,
  economics: TrendingUp,
  "current-affairs": Flame,
  "static-gk": BookOpenCheck,
};
export const SUBJECT_DEFAULT_ICONS: Record<string, LucideIcon> = {
  mathematics: Calculator,
  english: Languages,
  "general-awareness": Globe,
  reasoning: Brain,
};
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
  category: string;
  categoryCounts: Record<string, number>;
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
  availableLetters?: string[];
  onCategoryChange: (category: string) => void;
  onExamChange: (exam: string) => void;
  onSearchChange?: (search: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
  isLoading?: boolean;
  groupingStatus?: "ready" | "processing" | "failed" | "empty";
}
export interface IosQuizStartMobileProps {
  subjectConfig: SubjectConfig;
  title: string;
  slug: string;
  routeBase?: string;
  mode?: QuizMode;
  groups: ClassificationGroup[];
  category: string;
  categoryCounts: Record<string, number>;
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
  availableLetters?: string[];
  onCategoryChange: (category: string) => void;
  onExamChange: (exam: string) => void;
  onSearchChange?: (search: string) => void;
  onToggleGroup: (concepts: string[]) => void;
  onStart: () => void;
  isLoading?: boolean;
  groupingStatus?: "ready" | "processing" | "failed" | "empty";
}
