import rawData from "../../data/algebra_questions.json";

/* ── Types ─────────────────────────────────────────────── */

export interface AlgebraQuestion {
  id: number;
  concept: string;
  formula: string;
  question: string;
  options: string[];
  correctAnswer: number;
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: number;
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

  // Must check identities FIRST — before the ^ check
  // Matches both unicode (a²) and KaTeX (a^{2}) forms
  if (
    /identity/.test(t) ||
    /a\s*(\^{2}|²)\s*\+\s*b\s*(\^{2}|²)/.test(t) ||
    /\(x\s*\+\s*(1\/x|\\frac\{1\}\{x\})\)/.test(t) ||
    /\(x\s*-\s*(1\/x|\\frac\{1\}\{x\})\)/.test(t) ||
    /a\s*(\^{3}|³)/.test(t) ||
    /a\s*\+\s*b\s*\+\s*c/.test(t)
  )
    return "Algebraic Identities";

  // Quadratic — check before generic ^ pattern
  if (/quadratic|discriminant/.test(t) || /x\s*\^\{2\}.*=.*0/.test(t))
    return "Quadratic Equations";

  // Surds — only match explicit surd/sqrt keywords, NOT bare ^
  if (/\\sqrt|√|surd|\bindices\b|\bindicial\b/.test(t))
    return "Surds & Indices";

  if (/factor/.test(t)) return "Factorization";
  if (/polynomial|degree/.test(t)) return "Polynomials";
  if (/linear|simultaneous/.test(t)) return "Linear Equations";

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
    "Algebraic Identities": "(a \\pm b)^{2} = a^{2} \\pm 2ab + b^{2}",
    "Quadratic Equations":  "x = \\frac{-b \\pm \\sqrt{b^{2}-4ac}}{2a}",
    "Simplification":       "\\text{BODMAS / Value substitution}",
    "Surds & Indices":      "a^{m} \\times a^{n} = a^{m+n}",
    "Polynomials":          "\\text{Remainder \\& Factor theorem}",
    "Linear Equations":     "ax + b = 0 \\Rightarrow x = \\frac{-b}{a}",
    "Factorization":        "\\text{Common factor extraction}",
  };
  return map[c];
}

function estimatedTime(d: "easy" | "medium" | "hard"): number {
  return d === "easy" ? 40 : d === "medium" ? 60 : 80;
}

/* ── Raw JSON shape ─────────────────────────────────────── */

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

/* ── KaTeX sanitiser ────────────────────────────────────── */

/**
 * Ensures the string is safe to pass to katex.renderToString().
 * - Fixes unbraced superscripts:  ^2  →  ^{2}
 * - Fixes unbraced subscripts:    _2  →  _{2}
 * - Fixes bare \sqrt2  →  \sqrt{2}
 * - Removes stray $ signs (we do NOT use $ delimiters)
 */
function sanitiseKatex(s: string): string {
  return s
    // \sqrt followed by a single char not already braced
    .replace(/\\sqrt(?!\{)([^\s{\\])/g, "\\sqrt{$1}")
    // ^ or _ followed by single char not already braced
    .replace(/(\^|_)(?!\{)(-?[A-Za-z0-9])/g, "$1{$2}")
    // strip any stray dollar signs
    .replace(/\$/g, "");
}

/* ── Build enriched question bank ───────────────────────── */

export const algebraQuestions: AlgebraQuestion[] = (rawData as RawQ[]).map(
  (raw) => {
    const question  = sanitiseKatex(raw.question);
    const options   = raw.options.map(sanitiseKatex);
    const concept   = classifyConcept(question);
    const difficulty = classifyDifficulty(raw.exam);

    return {
      id:           raw.id,
      concept,
      formula:      formulaForConcept(concept),
      question,
      options,
      correctAnswer:
        typeof raw.correct_option_index === "number"
          ? raw.correct_option_index
          : options.findIndex(
              (o) => o.trim() === sanitiseKatex(raw.correct_answer).trim()
            ),
      answer:       sanitiseKatex(raw.correct_answer),
      difficulty,
      estimatedTime: estimatedTime(difficulty),
      year:         raw.year,
      exam:         raw.exam,
    };
  }
);

/* ── Query helpers ──────────────────────────────────────── */

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