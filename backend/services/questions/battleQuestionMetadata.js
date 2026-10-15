import { createHash } from 'node:crypto';
import { battleAnswerKey, battleQuestionType, battleMedia } from '../../battle/battleAnswers.js';
import { normalizeSearchKey } from './questionNormalizer.js';

export function battleQuestionMetadata(question) {
  const type = battleQuestionType(question), options = Array.isArray(question.options) ? question.options : [];
  const images = battleMedia(question);
  const choicesValid = options.length >= 2 && options.length <= 20 && options.every((option, index) => typeof option === 'string' && (option.trim() || images.optionImages[index]))
    && new Set(options.map((option, index) => JSON.stringify([option.trim(), images.optionImages[index]]))).size === options.length;
  const playable = Boolean(battleAnswerKey(question)) && (type === 'nat' || choicesValid);
  const difficulty = String(question.difficulty || '').trim().toLowerCase();
  const concept = normalizeSearchKey(question.concept || question.topic || question.chapter);
  const language = String(question.language || 'en').toLowerCase();
  const media = /!\[[^\]]*\]\(|<img\b/i.test([question.question, ...options].join(' ')) || images.questionImage || images.optionImages.some(Boolean) ? 'image' : 'text';
  return {
    battleEligible: playable,
    battleSelectionKey: createHash('sha256').update(String(question.questionUid || question._id || question.id)).digest('hex'),
    rankedEligible: question.rankedEligible === true && playable && ['easy', 'medium', 'hard'].includes(difficulty)
      && Boolean(question.questionUid) && Boolean(String(question.question || '').trim() || images.questionImage)
      && !['draft', 'rejected'].includes(String(question.validationStatus || '').toLowerCase())
      && Boolean(concept) && (type === 'nat' || options.length === 4),
    battleDifficulty: difficulty,
    battleConceptKey: concept,
    battleLanguage: ({ english: 'en', hindi: 'hi', bengali: 'bn' })[language] || language,
    battleMedia: media,
    battleExamKey: normalizeSearchKey(question.exam || question.source) || 'unspecified',
    battleYear: String(question.year || question.examYear || String(question.exam || '').match(/(?:19|20)\d{2}/)?.[0] || 'unspecified'),
  };
}
