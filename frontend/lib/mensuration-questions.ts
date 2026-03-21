import rawData from "../data/mensuration_questions.json";

/* ── Types ─────────────────────────────────────────────── */

export interface MensurationQuestion {
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
  "Circle & Sector",
  "Triangle & Polygon",
  "Quadrilateral",
  "2D Area & Perimeter",
  "3D Solids",
  "Cylinder, Cone & Sphere",
  "Ratio, Scaling & Similarity",
  "Coordinate & Mixed Mensuration",
] as const;

export type Concept = (typeof CONCEPTS)[number];

/* ── Classification helpers ────────────────────────────── */

function classifyConcept(q: string): Concept {
  const t = q.toLowerCase();

  if (/circle|sector|arc|radius|diameter|circumference|concentric/.test(t)) {
    return "Circle & Sector";
  }
  if (/triangle|equilateral|isosceles|right triangle|hypotenuse|hexagon|polygon/.test(t)) {
    return "Triangle & Polygon";
  }
  if (/square|rectangle|rhombus|trapezium|parallelogram/.test(t)) {
    return "Quadrilateral";
  }
  if (/cube|cuboid|prism|frustum|hemisphere|sphere|cylinder|cone|dome|pipe/.test(t)) {
    return "Cylinder, Cone & Sphere";
  }
  if (/volume|surface area|curved surface|melted|recast|solid/.test(t)) {
    return "3D Solids";
  }
  if (/ratio|similar|proportion|density|thickness/.test(t)) {
    return "Ratio, Scaling & Similarity";
  }
  if (/coordinate|distance|angle|inclined/.test(t)) {
    return "Coordinate & Mixed Mensuration";
  }
  return "2D Area & Perimeter";
}

function classifyDifficulty(exam: string): "easy" | "medium" | "hard" {
  const e = exam.toLowerCase();
  if (e.includes("tier ii") || e.includes("tier-ii") || e.includes("tier 2") || e.includes("tier-2")) {
    return "hard";
  }
  if (e.includes("chsl") || e.includes("mts") || e.includes("matriculation")) {
    return "easy";
  }
  return "medium";
}

function formulaForConcept(c: Concept): string {
  const map: Record<Concept, string> = {
    "Circle & Sector": "Arc = (theta/360) x 2pi r, Area = (theta/360) x pi r^2",
    "Triangle & Polygon": "A_triangle = 1/2 x b x h, A_equilateral = (sqrt(3)/4) a^2",
    Quadrilateral: "A_rect = l x b, A_square = a^2, A_rhombus = 1/2 x d1 x d2",
    "2D Area & Perimeter": "Perimeter and area standard formulas",
    "3D Solids": "Volume and TSA/CSA standard formulas",
    "Cylinder, Cone & Sphere": "V_cyl = pi r^2 h, V_cone = 1/3 pi r^2 h, V_sphere = 4/3 pi r^3",
    "Ratio, Scaling & Similarity": "Area ratio follows square, volume ratio follows cube",
    "Coordinate & Mixed Mensuration": "Use Pythagoras and shape decomposition",
  };
  return map[c];
}

function estimatedTime(d: "easy" | "medium" | "hard"): number {
  return d === "easy" ? 45 : d === "medium" ? 65 : 85;
}

/* ── Build enriched question bank ──────────────────────── */

interface RawQ {
  id: number;
  question: string;
  options: string[];
  answer: string;
  exam: string;
  year: string;
}

export const mensurationQuestions: MensurationQuestion[] = (rawData as RawQ[]).map((raw) => {
  const concept = classifyConcept(raw.question);
  const difficulty = classifyDifficulty(raw.exam);
  const correctAnswer = raw.options.findIndex((o) => o.trim() === raw.answer.trim());

  return {
    id: raw.id,
    concept,
    formula: formulaForConcept(concept),
    question: raw.question,
    options: raw.options,
    correctAnswer: correctAnswer >= 0 ? correctAnswer : 0,
    answer: raw.answer,
    difficulty,
    estimatedTime: estimatedTime(difficulty),
    year: raw.year,
    exam: raw.exam,
  };
});

export function getByConcept(c: string) {
  return mensurationQuestions.filter((q) => q.concept === c);
}

export function getTierTwoOnly() {
  return mensurationQuestions.filter((q) => q.difficulty === "hard");
}

export function getConceptCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of mensurationQuestions) {
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
