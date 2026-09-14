// Translate instructions while retaining the actual data a learner must solve.
export type QuestionTranslationPlan = {
  source: string[];
  texts: string[];
  restore: (translated: string[]) => string[];
};

export function planQuestionTranslation(
  question: { question?: string; options?: string[] },
  context = "",
): QuestionTranslationPlan {
  const source = [question.question ?? "", ...(question.options ?? [])];
  const literalAnswers = /\b(?:coding|decoding|code language|coded|letters?|alphabet(?:ical)?|word formation|word rearrangement|anagrams?|dictionary order|case.sensitive|spelling|synonyms?|antonyms?|grammar)\b/i.test(`${context} ${source[0]}`)
    || /^english\b/i.test(context.trim());
  const literals: string[] = [];
  // Choose a marker namespace absent from the source, including adversarial input.
  let prefix = "QZXKEEP";
  while (source.some((text) => text.includes(prefix))) prefix += "X";
  const protect = (text: string) => {
    const index = literals.push(text) - 1;
    return `${prefix}${index}XZQ`;
  };
  const texts: string[] = [];
  const slots = source.map((text, index) => {
    if (index > 0 && literalAnswers) return null;
    // Quotes are question data in language/letter puzzles. Always retain math,
    // inline code, uppercase identifiers and numeric expressions exactly.
    const pattern = literalAnswers
      ? /\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|`[^`]+`|'[^'\n]+'|"[^"\n]+"|‘[^’\n]+’|“[^”\n]+”|\b[A-Z]{2,}\b|\b\d+(?:[.,:/+−×÷=*-]\d+)*\b/g
      : /\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|`[^`]+`|\b[A-Z]{2,}\b|\b\d+(?:[.,:/+−×÷=*-]\d+)*\b/g;
    const masked = text.replace(pattern, protect);
    return texts.push(masked) - 1;
  });
  return {
    source,
    texts,
    restore(translated) {
      return slots.map((slot, index) => {
        if (slot === null) return source[index];
        let output = translated[slot] ?? texts[slot];
        // A provider must return each protected marker exactly once. If it
        // changes/drops/duplicates one, keep the source rather than corrupt data.
        for (let i = 0; i < literals.length; i += 1) {
          const marker = `${prefix}${i}XZQ`;
          const expected = texts[slot].split(marker).length - 1;
          if (output.split(marker).length - 1 !== expected) return source[index];
          if (expected) output = output.replace(marker, literals[i]);
        }
        return output.includes(prefix) ? source[index] : output;
      });
    },
  };
}
