export type Question = {
  id: string;
  topic: string;
  subject: string;
  chapter: string;
  subtopic: string;
  difficulty: string;
  exam: string;
  question: string;
  options: string[];
  correctAnswer: string;
  correctLetter: string;
  concept: string;
  source: string;
  quizName?: string;
  solution: string;
  solutionImage?: string;
  questionType?: string;
  questionImage?: string;
};

export const EMPTY_Q: Omit<Question, "id"> = {
  topic: "", subject: "", chapter: "", subtopic: "",
  difficulty: "medium", exam: "", question: "",
  options: ["", "", "", ""], correctAnswer: "",
  correctLetter: "", concept: "", source: "", solution: "",
};

export const DIFFICULTIES = ["easy", "medium", "hard"];
export const LETTERS = ["a", "b", "c", "d"];
export const SUBJECTS = ["mathematics", "reasoning", "english", "general awareness"];

export type SubjectKey = "mathematics" | "reasoning" | "english" | "general-awareness";
export type TopicOption = { value: string; label: string };
export type BulkStats = { total: number; ready: number; errors: number };
export type BulkImageItem = {
  id: string;
  file: File;
  previewUrl: string;
};

export const MAX_BULK_IMAGES = 20;

export const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const precision = value >= 10 || index === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[index]}`;
};

export const SUBJECT_OPTIONS: { value: SubjectKey; label: string }[] = [
  { value: "mathematics", label: "Mathematics" },
  { value: "reasoning", label: "Reasoning" },
  { value: "english", label: "English" },
  { value: "general-awareness", label: "General Awareness" },
];

export const DEFAULT_QUIZ_OPTIONS = [
  "PYQ",
  "CareerWill",
  "PW",
  "Selection Way",
  "Topic Mix",
  "Tier 2",
];

export const QUIZ_OPTIONS_BY_TOPIC: Record<string, string[]> = {
  mensuration: ["PYQ", "CareerWill", "Selection Way", "Tier 2"],
  "synonyms-antonyms": [...DEFAULT_QUIZ_OPTIONS, "Study Mode"],
  "one-word-substitution": [...DEFAULT_QUIZ_OPTIONS, "Study Mode"],
  "idioms-phrases": [...DEFAULT_QUIZ_OPTIONS, "Study Mode"],
  "spelling-misspelled-words": [...DEFAULT_QUIZ_OPTIONS, "Study Mode"],
  "homonyms-homophones": [...DEFAULT_QUIZ_OPTIONS, "Study Mode"],
};

const TOPIC_LABEL_OVERRIDES: Record<string, string> = {
  "active-passive-voice": "Active & Passive Voice",
  "direct-indirect-narration": "Direct & Indirect Narration",
  "subject-verb-agreement": "Subject-Verb Agreement",
  "homonyms-homophones": "Homonyms & Homophones",
  "idioms-phrases": "Idioms & Phrases",
  "synonyms-antonyms": "Synonyms & Antonyms",
  "sentence-correction-improvement": "Sentence Correction / Improvement",
  "spot-the-error-error-detection": "Spot the Error / Error Detection",
  "para-sentence-completion": "Para / Sentence Completion",
  "statement-conclusion": "Statement & Conclusion",
  "statement-assumptions": "Statement & Assumptions",
  "statement-arguments": "Statement & Arguments",
  "problem-solving-critical-thinking": "Problem Solving & Critical Thinking",
  "classification-odd-one-out": "Classification (Odd One Out)",
  "logical-sequence-of-words": "Logical Sequence of Words",
  "mathematical-symbolic-operations": "Mathematical & Symbolic Operations",
  "direction-distance": "Direction & Distance",
  "cube-dice": "Cube & Dice",
  "mirror-water-image": "Mirror & Water Image",
  "paper-folding-cutting": "Paper Folding & Cutting",
  "mixture-and-alligation": "Mixture & Alligation",
  "ratio-and-proportion": "Ratio & Proportion",
  "time-and-distance": "Time & Distance",
  "time-and-work": "Time & Work",
  "profit-and-loss": "Profit & Loss",
  "statistics-probability": "Statistics & Probability",
  "number-system": "Number System",
  "general-science": "General Science",
  "current-affairs": "Current Affairs",
  "static-gk": "Static GK",
};

const toTopicLabel = (slug: string) => {
  const override = TOPIC_LABEL_OVERRIDES[slug];
  if (override) return override;
  return slug
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
};

const MATH_TOPICS = [
  "algebra",
  "geometry",
  "mensuration",
  "trigonometry",
  "number-system",
  "statistics-probability",
  "averages",
  "discount",
  "interest",
  "simple-interest",
  "compound-interest",
  "mixture-and-alligation",
  "partnership",
  "percentages",
  "profit-and-loss",
  "ratio-and-proportion",
  "square-roots",
  "time-and-distance",
  "time-and-work",
];

const REASONING_TOPICS = [
  "analogy",
  "blood-relations",
  "classification-odd-one-out",
  "coding-decoding",
  "cube-dice",
  "direction-distance",
  "emotional-intelligence",
  "inequalities",
  "logical-sequence-of-words",
  "mathematical-symbolic-operations",
  "matrix",
  "mirror-water-image",
  "non-verbal-figures",
  "order-ranking",
  "paper-folding-cutting",
  "problem-solving-critical-thinking",
  "puzzle-seating-arrangement",
  "series",
  "social-intelligence",
  "statement-arguments",
  "statement-assumptions",
  "statement-conclusion",
  "syllogism-inferences",
  "venn-diagram",
  "word-building",
];

const ENGLISH_TOPICS = [
  "active-passive-voice",
  "articles",
  "cloze-test",
  "conjunctions",
  "direct-indirect-narration",
  "fill-in-the-blanks",
  "homonyms-homophones",
  "idioms-phrases",
  "modifiers",
  "one-word-substitution",
  "para-jumbles",
  "para-sentence-completion",
  "parallelism",
  "prepositions",
  "pronouns",
  "reading-comprehension",
  "sentence-correction-improvement",
  "sentence-structure",
  "spelling-misspelled-words",
  "spot-the-error-error-detection",
  "subject-verb-agreement",
  "synonyms-antonyms",
  "tenses",
];

const GA_TOPICS = [
  "current-affairs",
  "economics",
  "general-science",
  "geography",
  "history",
  "polity",
  "static-gk",
];

export const SUBJECT_TOPIC_OPTIONS: Record<SubjectKey, TopicOption[]> = {
  mathematics: MATH_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
  reasoning: REASONING_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
  english: ENGLISH_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
  "general-awareness": GA_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
};
