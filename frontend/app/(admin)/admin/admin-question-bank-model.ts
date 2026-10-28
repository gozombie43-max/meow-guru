import { JAM_SECTIONS, jamQuestionTopic } from '@meow/contracts/jam';
import {
  GENERAL_AWARENESS_TOPIC_GROUPS,
  getGeneralAwarenessTopicGroup,
} from '@/lib/general-awareness-topic-groups';

export type Question = {
  id: string;
  /** Stable API identity. `id` is a human-facing legacy value and may repeat. */
  questionUid?: string;
  topic: string;
  topicGroup?: string;
  chapterSlug?: string;
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

export const questionReference = (question: Pick<Question, "id" | "questionUid">) =>
  question.questionUid || question.id;

export const EMPTY_Q: Omit<Question, "id"> = {
  topic: "", subject: "", chapter: "", subtopic: "",
  difficulty: "medium", exam: "", question: "",
  options: ["", "", "", ""], correctAnswer: "",
  correctLetter: "", concept: "", source: "", solution: "",
};

export const DIFFICULTIES = ["easy", "medium", "hard"];
export const LETTERS = ["a", "b", "c", "d"];
export const SUBJECTS = ["mathematics", "reasoning", "english", "general awareness"];

export type SubjectKey = "mathematics" | "reasoning" | "english" | "general-awareness" | "iit-jam-physics";
export type TopicOption = { value: string; label: string };
export type ChapterOption = { value: string; label: string; slug: string; rank: number };
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
  "lcm-and-hcf": "LCM & HCF",
  "problems-on-ages": "Problems on Ages",
  "pipes-and-cisterns": "Pipes & Cisterns",
  "calendar-and-clock": "Calendar & Clock",
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
  "simplification",
  "lcm-and-hcf",
  "problems-on-ages",
  "pipes-and-cisterns",
  "calendar-and-clock",
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

export const GA_TOPICS = [
  "ancient-history",
  "medieval-history",
  "modern-history",
  "polity",
  "geography",
  "physics",
  "chemistry",
  "biology",
  "economy",
  "current-affairs",
  "static-gk",
];

export const SUBJECT_TOPIC_OPTIONS: Record<SubjectKey, TopicOption[]> = {
  "iit-jam-physics": JAM_SECTIONS.map(section => ({ value: jamQuestionTopic(section.slug), label: section.title })),
  mathematics: MATH_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
  reasoning: REASONING_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
  english: ENGLISH_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
  "general-awareness": GA_TOPICS.map((slug) => ({ value: slug, label: toTopicLabel(slug) })),
};

export const normalizeTopicKey = (t: string) =>
  String(t || "").toLowerCase().replace(/[-_\s]/g, "");

export const normalizeSubjectKey = (s: string) =>
  String(s || "").toLowerCase().replace(/[-_\s]/g, "");

const normalizeGaChapterLookupKey = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "");

type GaChapterMeta = {
  topicSlug: string;
  topicLabel: string;
  chapterTitle: string;
  chapterSlug: string;
  rank: number;
};

const GA_CHAPTER_LOOKUP = new Map<string, GaChapterMeta>();
const ALL_GA_CHAPTER_TITLES_AND_SLUGS: string[] = [];

for (const [groupSlug, group] of Object.entries(GENERAL_AWARENESS_TOPIC_GROUPS)) {
  const topicLabel = toTopicLabel(groupSlug);
  for (const ch of group.topics) {
    const meta: GaChapterMeta = {
      topicSlug: groupSlug,
      topicLabel,
      chapterTitle: ch.title,
      chapterSlug: ch.slug,
      rank: ch.rank,
    };
    ALL_GA_CHAPTER_TITLES_AND_SLUGS.push(ch.title, ch.slug);
    GA_CHAPTER_LOOKUP.set(normalizeGaChapterLookupKey(ch.title), meta);
    GA_CHAPTER_LOOKUP.set(normalizeGaChapterLookupKey(ch.slug), meta);
    GA_CHAPTER_LOOKUP.set(normalizeTopicKey(ch.title), meta);
    GA_CHAPTER_LOOKUP.set(normalizeTopicKey(ch.slug), meta);
  }
}

export function getGeneralAwarenessChaptersForTopic(topic: string): ChapterOption[] {
  if (!topic) return [];
  const normalized = normalizeTopicKey(topic);
  const matchedSlug = GA_TOPICS.find((slug) => normalizeTopicKey(slug) === normalized) || topic;
  const group = getGeneralAwarenessTopicGroup(matchedSlug);
  if (!group) return [];
  return group.topics.map((ch) => ({
    value: ch.title,
    label: ch.title,
    slug: ch.slug,
    rank: ch.rank,
  }));
}

export function findGeneralAwarenessChapterMeta(value: string): GaChapterMeta | null {
  if (!value) return null;
  return (
    GA_CHAPTER_LOOKUP.get(normalizeGaChapterLookupKey(value)) ||
    GA_CHAPTER_LOOKUP.get(normalizeTopicKey(value)) ||
    null
  );
}

export function resolveGeneralAwarenessQuestionTaxonomy(
  q: { subject?: string; topic?: string; chapter?: string; topicGroup?: string; chapterSlug?: string }
): { topicSlug: string; topicLabel: string; chapterTitle: string } | null {
  const subKey = normalizeSubjectKey(q.subject || "");
  const fromChapter =
    findGeneralAwarenessChapterMeta(q.chapterSlug || "") ||
    findGeneralAwarenessChapterMeta(q.chapter || "") ||
    findGeneralAwarenessChapterMeta(q.topic || "");

  if (fromChapter) {
    return {
      topicSlug: fromChapter.topicSlug,
      topicLabel: fromChapter.topicLabel,
      chapterTitle: q.chapter || fromChapter.chapterTitle,
    };
  }

  if (subKey === "generalawareness" || q.topicGroup) {
    const rawTopic = q.topicGroup || q.topic || "";
    const matchedTopic = GA_TOPICS.find((t) => normalizeTopicKey(t) === normalizeTopicKey(rawTopic));
    if (matchedTopic) {
      return {
        topicSlug: matchedTopic,
        topicLabel: toTopicLabel(matchedTopic),
        chapterTitle: q.chapter && normalizeTopicKey(q.chapter) !== normalizeTopicKey(matchedTopic) ? q.chapter : "",
      };
    }
  }

  return null;
}

const ALL_SUBJECT_TOPICS: Record<string, string[]> = {
  iitjamphysics: JAM_SECTIONS.map(section => jamQuestionTopic(section.slug)),
  mathematics: [...MATH_TOPICS, "mathematical-symbolic-operations"],
  reasoning: REASONING_TOPICS,
  english: ENGLISH_TOPICS,
  generalawareness: [...GA_TOPICS, ...ALL_GA_CHAPTER_TITLES_AND_SLUGS],
};

export function isTopicAllowedForSubject(topic: string, subject: string): boolean {
  if (!subject) return true;
  const subKey = normalizeSubjectKey(subject);
  if (!subKey) return true;

  const topKey = normalizeTopicKey(topic);
  if (!topKey) return false;

  if (subKey === "generalawareness") {
    return GA_TOPICS.some((t) => normalizeTopicKey(t) === topKey);
  }

  const currentSubjectTopics = ALL_SUBJECT_TOPICS[subKey];
  if (currentSubjectTopics?.some((t) => normalizeTopicKey(t) === topKey)) {
    return true;
  }

  const otherSubjects = Object.keys(ALL_SUBJECT_TOPICS).filter((k) => k !== subKey);
  const belongsToOther = otherSubjects.some((otherKey) =>
    ALL_SUBJECT_TOPICS[otherKey].some((t) => normalizeTopicKey(t) === topKey)
  );

  if (belongsToOther) {
    return false;
  }

  return true;
}

export function filterTopicsForSubject(topics: string[], subject: string): string[] {
  if (!subject) return topics;
  if (normalizeSubjectKey(subject) === "generalawareness") {
    const result = new Set<string>();
    for (const t of topics) {
      if (isTopicAllowedForSubject(t, subject)) {
        const canonical = GA_TOPICS.find((ga) => normalizeTopicKey(ga) === normalizeTopicKey(t)) || t;
        result.add(canonical);
      } else {
        const meta = findGeneralAwarenessChapterMeta(t);
        if (meta) result.add(meta.topicSlug);
      }
    }
    return Array.from(result);
  }
  return topics.filter((t) => isTopicAllowedForSubject(t, subject));
}

