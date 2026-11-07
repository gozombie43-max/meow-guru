/**
 * Sensitive fields strictly omitted from all public question reads.
 */
export const SENSITIVE_QUESTION_FIELDS = new Set([
  'correctAnswer',
  'correctLetter',
  'correctIndex',
  'correct_answer',
  'correct_letter',
  'solution',
  'solutionImage',
  'solutionImageWidth',
  'solutionImageHeight',
  'solutionText',
  'explanation',
  'answerKey',
  'answer',
  'ingestionKey',
  'ingestionHash',
  'battleSelectionKey',
  'trainingCandidate',
  'trainingEligible',
  'trainingMetadataVersion',
  'trainingExamSlugs',
  'trainingSubjectSlug',
  'trainingTopicSlug',
]);

const SENSITIVE_PATTERNS = [
  /^correct([A-Z_].*|$)/i,
  /^solution([A-Z_].*|$)/i,
  /^explanation([A-Z_].*|$)/i,
  /^answer(_?key)?$/i,
  /^ingestion([A-Z_].*|$)/i,
  /^battleSelection([A-Z_].*|$)/i,
  /^training(Candidate|Eligible|MetadataVersion|ExamSlugs|SubjectSlug|TopicSlug|_.*)?$/i,
];

export function isSensitiveField(key) {
  if (typeof key !== 'string') return false;
  if (SENSITIVE_QUESTION_FIELDS.has(key)) return true;
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

export function sanitizeTranslations(translations) {
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
    return translations;
  }
  const cleanTranslations = {};
  for (const [lang, content] of Object.entries(translations)) {
    if (!content || typeof content !== 'object' || Array.isArray(content)) {
      cleanTranslations[lang] = content;
      continue;
    }
    const cleanContent = {};
    for (const [key, value] of Object.entries(content)) {
      if (!isSensitiveField(key)) {
        cleanContent[key] = value;
      }
    }
    cleanTranslations[lang] = cleanContent;
  }
  return cleanTranslations;
}

// Session-only contract. Strips answer keys, solutions, and ingestion metadata.
export const quizQuestionProjection = Object.fromEntries([
  '_id', 'id', 'questionUid', 'topic', 'subject', 'chapter', 'concept', 'difficulty', 'exam', 'year', 'formula',
  'question', 'options',
  'quizName', 'questionType', 'questionImage', 'questionImageWidth', 'questionImageHeight',
  'optionRegions', 'diagram', 'needs_diagram',
  'word', 'letter', 'source', 'quizId', 'meanings', 'synonyms', 'antonyms', 'tags', 'translations'
].map(field => [field, 1]));

export function toPublicQuestionDTO(doc) {
  if (!doc || typeof doc !== 'object') return doc;
  const raw = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  const { _id, ...rest } = raw;
  const result = {};
  for (const [key, value] of Object.entries(rest)) {
    if (!isSensitiveField(key)) {
      if (key === 'translations') {
        result[key] = sanitizeTranslations(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

export function toQuizQuestionDTO(item) {
  if (!item || typeof item !== 'object') return item;
  const result = {};
  for (const field of Object.keys(quizQuestionProjection)) {
    if (field !== '_id' && item[field] !== undefined) {
      if (field === 'translations') {
        result[field] = sanitizeTranslations(item[field]);
      } else {
        result[field] = item[field];
      }
    }
  }
  if (item._id) result.sessionAnchor = String(item._id);
  else if (item.sessionAnchor) result.sessionAnchor = String(item.sessionAnchor);
  return result;
}
