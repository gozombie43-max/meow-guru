// frontend/lib/trigonometryQuestions.ts

import rawData from "../data/trigonometry_questions.json";

/* ── Types ──────────────────────────────────────────────── */

export interface TrigonometryQuestion {
  id: number;
  concept: string;
  formula: string;
  question: string;
  options: string[];
  correctAnswer: number;   // 0-based index into options[]
  answer: string;           // original answer text
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: number;    // seconds
  year: string;
  exam: string;
}

export const TRIG_CONCEPTS = [
  "Trigonometric Ratios & Values",
  "Trigonometric Identities",
  "Height & Distance",
  "Trigonometric Equations",
  "Graphs & Periodicity",
  "Complementary Angles",
  "Simplification",
] as const;

export type TrigConcept = (typeof TRIG_CONCEPTS)[number];

/* ── Classification helpers ─────────────────────────────── */

function classifyConcept(q: string): TrigConcept {
  const t = q.toLowerCase();

  // Height & Distance — check early: contains strong domain keywords
  if (/\b(tower|building|cliff|pole|tree|shadow|angle of elevation|angle of depression|height|distance|observer|horizontal)\b/.test(t))
    return "Height & Distance";

  // Complementary angles — 90°, (90-θ), sin/cos co-function patterns
  if (/90\s*[°\-]|complementary|\bco-?function\b|\bsin\s*\(\s*90|\bcos\s*\(\s*90/.test(t))
    return "Complementary Angles";

  // Identities — Pythagorean, product-to-sum, or named identities
  if (/\bidentit|\bsin²|\bcos²|\btan²|\bsec²|\bcosec²|\bcot²|1\s*[+-]\s*(sin|cos|tan)|pythagorean|\bsec\b.*\btan\b|\bcosec\b.*\bcot\b/.test(t))
    return "Trigonometric Identities";

  // Specific ratio / value — e.g. sin 30°, cos 45°, exact values
  if (/\bsin\s+\d|\bcos\s+\d|\btan\s+\d|\bcot\s+\d|\bsec\s+\d|\bcosec\s+\d|\bvalue\b.*\b(sin|cos|tan|cot)\b|\b(30|45|60|90|0)\s*°/.test(t))
    return "Trigonometric Ratios & Values";

  // Equations — solve/find θ, general solution
  if (/\bsolve\b|\bfind\s+\S*\s*(θ|theta|x)|\bgeneral\s+solution\b|\b=\s*0\b.*\b(sin|cos|tan)\b/.test(t))
    return "Trigonometric Equations";

  // Graphs & Periodicity
  if (/\bperiod\b|\bamplitude\b|\bgraph\b|\bwave\b|\boscillat/.test(t))
    return "Graphs & Periodicity";

  return "Simplification";
}

function classifyDifficulty(exam: string): "easy" | "medium" | "hard" {
  const e = exam.toLowerCase();
  if (e.includes("tier-ii") || e.includes("tier 2") || e.includes("tier ii")) return "hard";
  if (e.includes("chsl") || e.includes("mts") || e.includes("gd")) return "easy";
  return "medium";
}

function formulaForConcept(c: TrigConcept): string {
  const map: Record<TrigConcept, string> = {
    "Trigonometric Ratios & Values":
      "sin θ = P/H, cos θ = B/H, tan θ = P/B",
    "Trigonometric Identities":
      "sin²θ + cos²θ = 1; 1 + tan²θ = sec²θ; 1 + cot²θ = cosec²θ",
    "Height & Distance":
      "tan θ = height / base distance",
    "Trigonometric Equations":
      "General solution: sin x = sin α ⟹ x = nπ + (−1)ⁿα",
    "Graphs & Periodicity":
      "Period of sin/cos = 2π; period of tan/cot = π",
    "Complementary Angles":
      "sin(90°−θ) = cos θ;  tan(90°−θ) = cot θ",
    "Simplification":
      "BODMAS + standard identity substitution",
  };
  return map[c];
}

function estimatedTime(d: "easy" | "medium" | "hard"): number {
  return d === "easy" ? 40 : d === "medium" ? 60 : 80;
}

/* ── Raw shape (what actually comes out of the JSON) ────── */

interface RawQ {
  question?: string;
  text?: string;        // some dumps use "text" instead of "question"
  options: string[];
  answer: string;       // may be full option text OR a letter "a"/"b"/"c"/"d"
  correct?: string;     // alternate field name in some exports
  year?: string;
  exam?: string;
  subject?: string;
  chapter?: string;
}

/* ── Resolve the correct-answer index robustly ──────────── */

function findCorrectIndex(raw: RawQ): number {
  const rawAnswer = (raw.answer ?? raw.correct ?? "").trim();

  // Case 1 – single letter key  →  "a" / "b" / "c" / "d"
  const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
  if (/^[a-dA-D]$/.test(rawAnswer)) {
    return letterMap[rawAnswer.toLowerCase()];
  }

  // Case 2 – exact text match against an option
  const exact = raw.options.findIndex(
    (o) => o.trim().toLowerCase() === rawAnswer.toLowerCase()
  );
  if (exact >= 0) return exact;

  // Case 3 – partial / contained match (handles minor whitespace or punctuation drift)
  const partial = raw.options.findIndex((o) =>
    o.trim().toLowerCase().includes(rawAnswer.toLowerCase()) ||
    rawAnswer.toLowerCase().includes(o.trim().toLowerCase())
  );
  return partial >= 0 ? partial : 0;
}

/* ── Normalise option arrays ────────────────────────────── */

function normaliseOptions(raw: RawQ): string[] {
  // Some exports carry objects like { label: "a", text: "..." } — flatten them
  return raw.options.map((o) => {
    if (typeof o === "string") return o.trim();
    // Handle { text: string } shape just in case
    const obj = o as unknown as { text?: string; label?: string };
    return (obj.text ?? obj.label ?? String(o)).trim();
  });
}

/* ── Build enriched question bank ───────────────────────── */

export const trigonometryQuestions: TrigonometryQuestion[] = (
  rawData as RawQ[]
).map((raw, i) => {
  const questionText = (raw.question ?? raw.text ?? "").trim();
  const options = normaliseOptions(raw);
  const concept = classifyConcept(questionText);
  const difficulty = classifyDifficulty(raw.exam ?? "");

  return {
    id: i + 1,
    concept,
    formula: formulaForConcept(concept),
    question: questionText,
    options,
    correctAnswer: findCorrectIndex({ ...raw, options }),
    answer: (raw.answer ?? raw.correct ?? "").trim(),
    difficulty,
    estimatedTime: estimatedTime(difficulty),
    year: raw.year ?? "",
    exam: raw.exam ?? "",
  };
});

/* ── Query helpers (mirrors algebra loader API) ──────────── */

export function getByDifficulty(d: "easy" | "medium" | "hard"): TrigonometryQuestion[] {
  return trigonometryQuestions.filter((q) => q.difficulty === d);
}

export function getByConcept(c: string): TrigonometryQuestion[] {
  return trigonometryQuestions.filter((q) => q.concept === c);
}

export function getConceptCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of trigonometryQuestions) {
    counts[q.concept] = (counts[q.concept] || 0) + 1;
  }
  return counts;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}