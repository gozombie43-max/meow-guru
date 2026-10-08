

export function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function escapeRegex(value = '') {
  return String(value).replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
}

export function exactCI(value) {
  return new RegExp(
    `^${escapeRegex(value)}$`,
    'i'
  );
}

export function cleanMongoDoc(doc) {
  if (!doc) return doc;

  const {
    _id,
    _cosmosRid,
    ...clean
  } = doc;

  return clean;
}

export function summarizeSlot(slot) {
  const clean = cleanMongoDoc(slot);
  const {
    fixedQuestions,
    ...summary
  } = clean;

  return {
    ...summary,
    hasFixedPaper: Array.isArray(fixedQuestions) ? fixedQuestions.length > 0 : clean.hasFixedPaper === true,
    questionCount:
      fixedQuestions?.length ||
      clean.questionCount ||
      0,
  };
}

export function stripAnswer(q) {
  const { correctAnswer, answer, ...rest } = q;
  return { ...rest, legacyId: q.legacyId || q.id, id: q.questionUid || q.id };
}
