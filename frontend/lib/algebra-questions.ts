import rawData from "../../data/algebra_questions.json";

/* ── Types ─────────────────────────────────────────────── */

export interface AlgebraQuestion {
  id: number;
  concept: string;
  formula: string;
  question: string;
  options: string[];
  correctAnswer: number;   // index in options[]
  answer: string;           // original answer text
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: number;    // seconds
  year: string;
  exam: string;
}

export const CONCEPTS = [
  "Algebraic Identities",
  "Quadratic Equations",
  "Simplification",
  "Surds & Indices",
  "Polynomials",
  "Linear Equations",
  "Factorization",
] as const;

export type Concept = (typeof CONCEPTS)[number];

/* ── Classification helpers ────────────────────────────── */

function classifyConcept(q: string): Concept {
  const t = q.toLowerCase();
  if (/identity|a\s*²\s*\+\s*b\s*²|a\s*³|a\+b|a-b|\(x\s*\+\s*1\/x\)|\(x\s*-\s*1\/x\)/.test(t))
    return "Algebraic Identities";
  if (/quadratic|root|x\s*².*=\s*0|discriminant/.test(t))
    return "Quadratic Equations";
  if (/√|surd|indic|power|expo|\^/.test(t))
    return "Surds & Indices";
  if (/factor/.test(t))
    return "Factorization";
  if (/polynomial|degree/.test(t))
    return "Polynomials";
  if (/linear|simultaneous/.test(t))
    return "Linear Equations";
  return "Simplification";
}

function classifyDifficulty(exam: string): "easy" | "medium" | "hard" {
  const e = exam.toLowerCase();
  if (e.includes("tier-ii") || e.includes("tier 2")) return "hard";
  if (e.includes("chsl") || e.includes("mts")) return "easy";
  return "medium";
}

function formulaForConcept(c: Concept): string {
  const map: Record<Concept, string> = {
    "Algebraic Identities": "(a±b)² = a² ± 2ab + b²",
    "Quadratic Equations": "x = (-b ± √(b²-4ac)) / 2a",
    "Simplification": "BODMAS / Value substitution",
    "Surds & Indices": "aᵐ × aⁿ = aᵐ⁺ⁿ",
    "Polynomials": "Remainder & Factor theorem",
    "Linear Equations": "ax + b = 0 → x = -b/a",
    "Factorization": "Common factor extraction",
  };
  return map[c];
}

function estimatedTime(d: "easy" | "medium" | "hard"): number {
  return d === "easy" ? 40 : d === "medium" ? 60 : 80;
}

/* ── Build enriched question bank ──────────────────────── */

interface RawQ {
  id: number;
  year: string;
  exam: string;
  date?: string;
  question: string;
  options: string[];
  correct_option_index: number;
  correct_answer: string;
}

export const algebraQuestions: AlgebraQuestion[] = (rawData as RawQ[]).map(
  (raw) => {
    const concept = classifyConcept(raw.question);
    const difficulty = classifyDifficulty(raw.exam);
    return {
      id: raw.id,
      concept,
      formula: formulaForConcept(concept),
      question: raw.question,
      options: raw.options,
      correctAnswer: typeof raw.correct_option_index === 'number' ? raw.correct_option_index : raw.options.findIndex((o) => o.trim() === raw.correct_answer.trim()),
      answer: raw.correct_answer,
      difficulty,
      estimatedTime: estimatedTime(difficulty),
      year: raw.year,
      exam: raw.exam,
    };
  }
);

/* ── Query helpers ─────────────────────────────────────── */

export function getByDifficulty(d: "easy" | "medium" | "hard") {
  return algebraQuestions.filter((q) => q.difficulty === d);
}

export function getByConcept(c: string) {
  return algebraQuestions.filter((q) => q.concept === c);
}

export function getConceptCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of algebraQuestions) {
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
