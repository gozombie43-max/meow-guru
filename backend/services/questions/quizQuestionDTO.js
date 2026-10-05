// Session-only contract. Admin/training reads keep their own metadata.
export const quizQuestionProjection = Object.fromEntries([
  '_id', 'id', 'topic', 'subject', 'chapter', 'concept', 'difficulty', 'exam', 'formula',
  'question', 'options', 'correctAnswer', 'correctLetter', 'solution', 'solutionImage',
  'quizName', 'questionType', 'questionImage', 'questionImageWidth', 'questionImageHeight',
  'solutionImageWidth', 'solutionImageHeight', 'optionRegions', 'diagram', 'needs_diagram',
  'word', 'letter', 'source', 'quizId', 'meanings', 'synonyms', 'antonyms',
].map(field => [field, 1]));

export function toQuizQuestionDTO(item) {
  const result = {};
  for (const field of Object.keys(quizQuestionProjection)) {
    if (field !== '_id' && item[field] !== undefined) result[field] = item[field];
  }
  if (item._id) result.sessionAnchor = String(item._id);
  return result;
}
