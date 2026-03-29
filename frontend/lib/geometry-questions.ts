import rawData from "../data/geometry_questions.json";

export interface GeometryQuestion {
  id: number;
  concept: string;
  formula: string;
  question: string;
  options: string[];
  correctAnswer: number; // 0-based index
  answer: string;
  difficulty: "easy" | "medium" | "hard";
  estimatedTime: number;
  year: string;
  exam: string;
}

export const GEOM_CONCEPTS = [
  "Circle Geometry",
  "Triangle Geometry",
  "Quadrilaterals",
  "Similarity & Congruence",
  "Mensuration",
  "Angle Properties",
  "General Geometry",
] as const;

type GeomConcept = (typeof GEOM_CONCEPTS)[number];

function classifyConcept(q: string): GeomConcept {
  const t = q.toLowerCase();

  if (/circle|tangent|secant|chord|arc|sector|radius|diameter/.test(t))
    return "Circle Geometry";
  if (/triangle|right angled|obtuse|isosceles|equilateral|median|altitude|perimeter/.test(t))
    return "Triangle Geometry";
  if (/quadrilateral|square|rectangle|rhombus|parallelogram|trapez|wxyz/.test(t))
    return "Quadrilaterals";
  if (/similar|congruent|ratio|proportion|bisector|parallel/.test(t))
    return "Similarity & Congruence";
  if (/area|perimeter|volume|surface|semicircle|sector|circumference/.test(t))
    return "Mensuration";
  if (/angle|parallel|alternate|interior|exterior/.test(t))
    return "Angle Properties";

  return "General Geometry";
}

function classifyDifficulty(exam: string): "easy" | "medium" | "hard" {
  const e = exam.toLowerCase();
  if (e.includes("tier-ii") || e.includes("tier 2") || e.includes("tier ii") || e.includes("graduate")) return "hard";
  if (e.includes("chsl") || e.includes("cpo") || e.includes("ssc cgl")) return "medium";
  return "easy";
}

function formulaForConcept(c: GeomConcept): string {
  const map: Record<GeomConcept, string> = {
    "Circle Geometry": "∠ in same segment = 1/2 arc; tangent-chord angle = 1/2 (difference of arcs)",
    "Triangle Geometry": "Sum of angles=180°; Pythagoras a²+b²=c²; area=1/2bc sinA",
    "Quadrilaterals": "Sum of interior angles=360°; opposite angles in cyclic quad are supplementary",
    "Similarity & Congruence": "Corresponding sides are proportional; equal ratios give similarity",
    "Mensuration": "Area formulas: circle πr², sector πr²θ/360, triangle 1/2 bh",
    "Angle Properties": "Alternate interior angles equal; corresponding angles equal when parallel lines",
    "General Geometry": "Use base Euclidean angle/chord/circular rules",
  };
  return map[c];
}

function estimatedTime(d: "easy" | "medium" | "hard"): number {
  return d === "easy" ? 40 : d === "medium" ? 60 : 80;
}

interface RawQ {
  id?: number;
  question?: string;
  text?: string;
  options: string[];
  answer?: string;
  correct?: string;
  year?: string;
  exam?: string;
  subject?: string;
  chapter?: string;
}

function findCorrectIndex(raw: RawQ): number {
  const rawAnswer = (raw.answer ?? raw.correct ?? "").trim();
  const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };
  if (/^[a-dA-D]$/.test(rawAnswer)) return letterMap[rawAnswer.toLowerCase()];

  const exact = raw.options.findIndex((o) => o.trim().toLowerCase() === rawAnswer.toLowerCase());
  if (exact >= 0) return exact;

  const partial = raw.options.findIndex((o) =>
    o.trim().toLowerCase().includes(rawAnswer.toLowerCase()) || rawAnswer.toLowerCase().includes(o.trim().toLowerCase())
  );
  return partial >= 0 ? partial : 0;
}

function normaliseOptions(raw: RawQ): string[] {
  return raw.options.map((o) => {
    if (typeof o === "string") return o.trim();
    const obj = o as unknown as { text?: string; label?: string };
    return (obj.text ?? obj.label ?? String(o)).trim();
  });
}

export const geometryQuestions: GeometryQuestion[] = (rawData as RawQ[]).map((raw, i) => {
  let questionText = (raw.question ?? raw.text ?? "").trim();

  // remove trailing exam metadata accidentally included in question text
  if (raw.exam) {
    const escapedExam = raw.exam.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    questionText = questionText.replace(new RegExp(`${escapedExam}$`), "").trim();
  }
  questionText = questionText.replace(/\s+(?:SSC|CHSL|CGL|CPO|Graduate\s+Level|Matriculation\s+Level)[^\n]*$/i, "").trim();

  const options = normaliseOptions(raw);
  const concept = classifyConcept(questionText);
  const difficulty = classifyDifficulty(raw.exam ?? "");

  return {
    id: raw.id ?? i + 1,
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

export function getByDifficulty(d: "easy" | "medium" | "hard"): GeometryQuestion[] {
  return geometryQuestions.filter((q) => q.difficulty === d);
}

export function getByConcept(c: string): GeometryQuestion[] {
  return geometryQuestions.filter((q) => q.concept === c);
}

export function getConceptCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of geometryQuestions) {
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
