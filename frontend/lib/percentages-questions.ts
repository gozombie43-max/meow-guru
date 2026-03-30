import rawData from "../data/percentages_questions.json";

export interface PercentageQuestion {
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

export const PERCENTAGE_CONCEPTS = [
  "Basic Percentage",
  "Percentage Increase/Decrease",
  "Discount & Marked Price",
  "Profit/Loss",
  "Compound Percentage",
  "Conversion",
] as const;

type PercentageConcept = (typeof PERCENTAGE_CONCEPTS)[number];

function classifyConcept(q: string): PercentageConcept {
  const t = q.toLowerCase();

  if (/discount|marked price|sale|cost price|selling price/.test(t))
    return "Discount & Marked Price";
  if (/profit|loss|gain|loss percent/.test(t))
    return "Profit/Loss";
  if (/increased|decreased|increase|decrease|net change/.test(t))
    return "Percentage Increase/Decrease";
  if (/compound|grown|compound interest|c.i\.?/.test(t))
    return "Compound Percentage";
  if (/convert|of a number|what is.*%|% of|\d+%/.test(t))
    return "Basic Percentage";

  return "Conversion";
}

function classifyDifficulty(exam: string): "easy" | "medium" | "hard" {
  const e = (exam ?? "").toLowerCase();
  if (e.includes("tier-ii") || e.includes("tier 2") || e.includes("graduate")) return "hard";
  if (e.includes("chsl") || e.includes("cpo")) return "medium";
  return "easy";
}

function formulaForConcept(c: PercentageConcept): string {
  const map: Record<PercentageConcept, string> = {
    "Basic Percentage": "x% of y = (x/100) * y",
    "Percentage Increase/Decrease": "New = Original * (1 ± r/100)",
    "Discount & Marked Price": "SP = MP * (1 - d/100)",
    "Profit/Loss": "Profit% = ((SP - CP)/CP)×100",
    "Compound Percentage": "A = P (1 + r/100)^n",
    "Conversion": "Fraction ↔ Percentage ↔ Decimal",
  };
  return map[c];
}

function estimatedTime(d: "easy" | "medium" | "hard"): number {
  return d === "easy" ? 40 : d === "medium" ? 60 : 80;
}

interface RawQ {
  question: string;
  options: string[];
  answer: string;
  year?: string;
  exam?: string;
}

function normalizeAsFractionClusters(text: string): string {
  let t = text.trim();

  if (!t) return t;

  // Keep existing slashed format (and mixed value with %)
  t = t.replace(/(\d+)\s+(\d+)\s+(\d+)\s*%/g, "$1 $2/$3%");
  t = t.replace(/(\d+)\s+(\d+)\s+(\d+)\b/g, "$1 $2/$3");

  const tokens = t.split(/\s+/).filter(Boolean);
  const allNumericish = tokens.every((tk) => /^\d+%?$/.test(tk));
  if (!allNumericish) return t;

  if (tokens.length >= 2 && tokens.every((tk) => /^\d+$/.test(tk))) {
    // Convert full numeric sequence into fractions.
    if (tokens.length % 2 === 0) {
      return tokens
        .reduce((acc, tk, idx) => {
          if (idx % 2 === 0) {
            return acc ? `${acc} ${tk}` : tk;
          }
          return `${acc}/${tk}`;
        }, "")
        .trim();
    }

    if (tokens.length >= 3) {
      // mixed fraction first item + remaining pairs
      let output = `${tokens[0]} ${tokens[1]}/${tokens[2]}`;
      const rest = tokens.slice(3);
      if (rest.length >= 2) {
        const extra = rest.reduce((acc, tk, idx) => {
          if (idx % 2 === 0) {
            return acc ? `${acc} ${tk}` : tk;
          }
          return `${acc}/${tk}`;
        }, "");
        output += ` ${extra}`;
      }
      return output;
    }
  }

  // “packed” cluster where % may be there as separate token e.g. 1 125 1 500 1 200 1 40
  const numericTokens = tokens.map((tk) => (tk.endsWith("%") ? tk.slice(0, -1) : tk));
  if (numericTokens.every((tk) => /^\d+$/.test(tk))) {
    if (numericTokens.length % 2 === 0 && numericTokens.length > 2) {
      return numericTokens
        .reduce((acc, tk, idx) => {
          if (idx % 2 === 0) {
            return acc ? `${acc} ${tk}` : tk;
          }
          return `${acc}/${tk}`;
        }, "")
        .trim();
    }
    if (numericTokens.length > 3 && numericTokens.length % 2 === 1) {
      let output = `${numericTokens[0]} ${numericTokens[1]}/${numericTokens[2]}`;
      const rest = numericTokens.slice(3);
      if (rest.length >= 2) {
        const extra = rest.reduce((acc, tk, idx) => {
          if (idx % 2 === 0) {
            return acc ? `${acc} ${tk}` : tk;
          }
          return `${acc}/${tk}`;
        }, "");
        output += ` ${extra}`;
      }
      return output;
    }
  }

  return t;
}

function splitFractionSequence(source: string): string[] {
  const tokens = source.trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let i = 0;

  while (i < tokens.length && out.length < 4) {
    const token = tokens[i];

    // Mixed fraction style: whole num denom
    if (
      i + 2 < tokens.length &&
      /^\d+$/.test(token) &&
      /^\d+%?$/.test(tokens[i + 1]) &&
      /^\d+%?$/.test(tokens[i + 2])
    ) {
      out.push(`${token} ${tokens[i + 1]}/${tokens[i + 2]}`);
      i += 3;
      continue;
    }

    // Simple pair: num denom
    if (i + 1 < tokens.length && /^\d+%?$/.test(token) && /^\d+%?$/.test(tokens[i + 1])) {
      out.push(`${token}/${tokens[i + 1]}`);
      i += 2;
      continue;
    }

    // Already fraction token
    if (/^\d+\/\d+%?$/.test(token) || /^\d+%$/.test(token)) {
      out.push(token);
      i += 1;
      continue;
    }

    break;
  }

  return out;
}

function normalizeOptionText(option: string): string[] {
  const raw = option.trim();
  if (!raw) return [""];

  const normalized = normalizeAsFractionClusters(raw);

  const parts = normalized.split(/\s{2,}|\s*\|\s*/).flatMap((part) => {
    const p = part.trim();
    if (!p) return [];

    const chunks = splitFractionSequence(p);
    if (chunks.length > 1) {
      return chunks;
    }

    return [p];
  });

  return parts.length > 0 ? parts : [normalized];
}

function splitJoinedOptions(options: string[]): string[] {
  const clean = [...options];
  const nonEmpty = clean.filter((x) => x.trim()).length;

  if (nonEmpty === 1) {
    const source = clean.find((x) => x.trim())?.trim() ?? "";
    const candidates = splitFractionSequence(source);
    if (candidates.length >= 2 && candidates.length <= 4) {
      const final = [...candidates];
      while (final.length < 4) final.push("");
      return final;
    }
  }

  return clean;
}

function findCorrectIndex(raw: RawQ): number {
  const rawAnswer = raw.answer.trim();
  const letterMap: Record<string, number> = { a: 0, b: 1, c: 2, d: 3 };

  if (/^[a-dA-D]$/.test(rawAnswer)) {
    return letterMap[rawAnswer.toLowerCase()];
  }

  const exact = raw.options.findIndex((opt) => opt.trim().toLowerCase() === rawAnswer.toLowerCase());
  if (exact >= 0) return exact;

  const partial = raw.options.findIndex((opt) => {
    const o = opt.trim().toLowerCase();
    const a = rawAnswer.toLowerCase();
    return o === a || o.includes(a) || a.includes(o);
  });

  return partial >= 0 ? partial : 0;
}

export const percentagesQuestions: PercentageQuestion[] = (rawData as RawQ[]).map((raw, i) => {
  const questionText = normalizeAsFractionClusters(raw.question.trim());
  const concept = classifyConcept(questionText);
  const difficulty = classifyDifficulty(raw.exam ?? "");

  const normalizedOptions = raw.options.flatMap((o) => normalizeOptionText(o));
  const splitOptions = splitJoinedOptions(normalizedOptions);

  // Ensure exactly 4 options (pad empty if needed)
  const finalOptions = [...splitOptions].slice(0, 4);
  while (finalOptions.length < 4) {
    finalOptions.push("");
  }

  const question = {
    id: i + 1,
    concept,
    formula: formulaForConcept(concept),
    question: questionText,
    options: finalOptions.map((o) => normalizeAsFractionClusters(o.trim())),
    correctAnswer: findCorrectIndex({
      question: questionText,
      options: finalOptions,
      answer: raw.answer,
      year: raw.year,
      exam: raw.exam,
    }),
    answer: raw.answer.trim(),
    difficulty,
    estimatedTime: estimatedTime(difficulty),
    year: raw.year ?? "",
    exam: raw.exam ?? "",
  };

  return question;
});

export function getByDifficulty(d: "easy" | "medium" | "hard"): PercentageQuestion[] {
  return percentagesQuestions.filter((q) => q.difficulty === d);
}

export function getByConcept(c: string): PercentageQuestion[] {
  return percentagesQuestions.filter((q) => q.concept === c);
}

export function getConceptCounts(): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of percentagesQuestions) {
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
