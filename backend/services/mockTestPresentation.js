import { sanitizeTranslations } from './questions/quizQuestionDTO.js';

// Only question content needed to take an exam may cross the active-attempt boundary.
// Keep full persisted content for completed-test review (minus internal ingestion/training/battle metadata).
const QUESTION_FIELDS = [
  'id', 'text', 'question', 'questionHindi', 'questionType', 'options',
  'image', 'questionImage', 'optionImages', 'optionAImage', 'optionBImage',
  'questionImageWidth', 'questionImageHeight',
  'optionCImage', 'optionDImage', 'passage', 'sectionKey', 'subject', 'topic',
  'translations',
];

const REVIEW_INTERNAL_FIELDS = new Set([
  '_id',
  '_cosmosRid',
  'ingestionKey',
  'ingestionHash',
  'battleSelectionKey',
  'trainingCandidate',
  'trainingEligible',
  'trainingMetadataVersion',
  'trainingExamSlugs',
  'trainingSubjectSlug',
  'trainingTopicSlug',
  'selectionKey',
  'examKey',
  'conceptKey',
  'chapterKey',
  'topicGroupKey',
  'examModeKey',
  'topicKey',
  'subjectKey',
  'quizKey',
  'modeKey',
  'keyVersion',
  'yearInt',
  'shiftInt',
]);

const REVIEW_INTERNAL_PATTERNS = [
  /^ingestion([A-Z_].*|$)/i,
  /^battleSelection([A-Z_].*|$)/i,
  /^training(Candidate|Eligible|MetadataVersion|ExamSlugs|SubjectSlug|TopicSlug|_.*)?$/i,
];

function isInternalReviewField(key) {
  if (REVIEW_INTERNAL_FIELDS.has(key)) return true;
  return REVIEW_INTERNAL_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizeActiveTranslations(translations) {
  if (!translations || typeof translations !== 'object' || Array.isArray(translations)) {
    return translations;
  }
  // Shape A (schemaDriven papers): { question: { en, bn }, options: { en, bn }, solution: { en, bn } }
  if (Object.hasOwn(translations, 'question') || Object.hasOwn(translations, 'options') || Object.hasOwn(translations, 'solution')) {
    return {
      ...(translations.question !== undefined ? { question: translations.question } : {}),
      ...(translations.options !== undefined ? { options: translations.options } : {}),
    };
  }
  // Shape B (dynamic question bank docs): { bn: { question, options, solution }, hi: { ... } }
  return sanitizeTranslations(translations);
}

export function activePaper(paper) {
  return {
    ...paper,
    sections: (paper?.sections || []).map((section) => ({
      ...section,
      questions: (section.questions || []).map((question) => {
        const safe = Object.fromEntries(
          QUESTION_FIELDS
            .filter((key) => Object.hasOwn(question, key))
            .map((key) => [key, question[key]]),
        );
        if (Array.isArray(safe.options)) {
          safe.options = safe.options.map((option) => (typeof option === 'object' && option !== null
            ? Object.fromEntries(['id', 'text', 'image'].filter((key) => Object.hasOwn(option, key)).map((key) => [key, option[key]]))
            : option));
        }
        if (safe.translations) {
          safe.translations = sanitizeActiveTranslations(safe.translations);
        }
        return safe;
      }),
    })),
  };
}

/**
 * Sanitize a completed non-confidential mock paper for review:
 * retains solutions/explanations/translations while stripping internal ingestion,
 * training, battle, and normalized-key metadata fields.
 */
export function reviewPaper(paper) {
  if (!paper || typeof paper !== 'object') return paper;
  return {
    ...paper,
    sections: (paper.sections || []).map((section) => ({
      ...section,
      questions: (section.questions || []).map((question) => {
        if (!question || typeof question !== 'object') return question;
        const clean = {};
        for (const [key, value] of Object.entries(question)) {
          if (!isInternalReviewField(key)) {
            clean[key] = value;
          }
        }
        return clean;
      }),
    })),
  };
}
