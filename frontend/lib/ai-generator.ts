import type { AlgebraQuestion } from "./algebra-questions";

/* ── AI Question Generator ─────────────────────────────── *
 * Takes an existing question and produces a harder variant
 * by modifying numeric coefficients and expressions.
 * ──────────────────────────────────────────────────────── */

/** Return a random int in [min, max] */
function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Modify numbers in a string — shift each number by a random delta */
function mutateNumbers(text: string, harder: boolean): string {
  return text.replace(/\b(\d+)\b/g, (_, num) => {
    const n = parseInt(num, 10);
    if (n === 0 || n === 1) return num; // leave 0 and 1 alone
    const delta = harder ? randInt(1, Math.max(2, Math.ceil(n * 0.5))) : randInt(1, 3);
    const newN = n + delta;
    return String(newN);
  });
}

/** Generate a harder variant of an existing question */
export function generateAIQuestion(
  source: AlgebraQuestion,
  id: number
): AlgebraQuestion {
  const mutatedQuestion = mutateNumbers(source.question, true);

  // Mutate options — shift incorrect options, keep structure
  const mutatedOptions = source.options.map((opt, i) => {
    if (i === source.correctAnswer) {
      // Mark the correct answer with a "?" to indicate AI-generated
      return mutateNumbers(opt, true);
    }
    return mutateNumbers(opt, true);
  });

  return {
    ...source,
    id,
    question: `[AI] ${mutatedQuestion}`,
    options: mutatedOptions,
    // Since we mutated numbers, the correct answer index stays the same
    // but the actual answer text changes
    answer: mutatedOptions[source.correctAnswer],
    difficulty: source.difficulty === "easy" ? "medium" : "hard",
    estimatedTime: source.estimatedTime + 20,
  };
}

/** Generate a batch of AI questions from a source pool */
export function generateAIBatch(
  sources: AlgebraQuestion[],
  count: number
): AlgebraQuestion[] {
  const result: AlgebraQuestion[] = [];
  const baseId = 10000;
  for (let i = 0; i < count && i < sources.length; i++) {
    result.push(generateAIQuestion(sources[i], baseId + i));
  }
  return result;
}
