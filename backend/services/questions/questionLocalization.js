export const isLocalizedText = value =>
  value &&
  typeof value === "object" &&
  !Array.isArray(value);

export function normalizeLocalizedQuestion(input) {
  const item = { ...input };

  const questionLocalized = isLocalizedText(item.question)
    ? item.question
    : null;

  const optionsLocalized =
    item.options &&
    typeof item.options === "object" &&
    !Array.isArray(item.options)
      ? item.options
      : null;

  const solutionLocalized = isLocalizedText(item.solution)
    ? item.solution
    : null;

  const answerLocalized = isLocalizedText(item.correctAnswer)
    ? item.correctAnswer
    : null;

  if (!questionLocalized && !optionsLocalized && !solutionLocalized && !answerLocalized) {
    // Legacy question — leave completely unchanged.
    return item;
  }

  if (answerLocalized) {
    item.correctAnswer = answerLocalized.en ?? answerLocalized.bn ?? "";
  }

  const translations = {
    ...(item.translations ?? {}),
  };

  // English becomes canonical source.
  if (questionLocalized) {
    item.question =
      questionLocalized.en ??
      questionLocalized.bn ??
      "";

    if (questionLocalized.bn) {
      translations.bn = {
        ...(translations.bn ?? {}),
        question: questionLocalized.bn,
      };
    }
  }

  if (optionsLocalized) {
    item.options =
      optionsLocalized.en ??
      optionsLocalized.bn ??
      [];

    if (optionsLocalized.bn) {
      translations.bn = {
        ...(translations.bn ?? {}),
        options: optionsLocalized.bn,
      };
    }
  }

  if (solutionLocalized) {
    item.solution =
      solutionLocalized.en ??
      solutionLocalized.bn ??
      "";

    if (solutionLocalized.bn) {
      translations.bn = {
        ...(translations.bn ?? {}),
        solution: solutionLocalized.bn,
      };
    }
  }

  if (Object.keys(translations).length) {
    item.translations = translations;
  }

  return item;
}
