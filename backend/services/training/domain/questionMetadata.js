import { normalizeQuestion } from './questionNormalizer.js';
import { normalizeTrainingSubject } from '../../trainingSubjects.js';

export const TRAINING_METADATA_VERSION = 1;
export const trainingExamPattern = exam => exam === 'cat'
  ? /^\s*CAT\b/i
  : new RegExp(`^\\s*SSC[ -]*(?:CGL\\s*[/&]\\s*|CHSL\\s*[/&]\\s*)?${exam === 'ssc-chsl' ? 'CHSL' : 'CGL'}\\b`, 'i');
export const trainingSlug = value => String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');

export function trainingQuestionMetadata(row) {
  const labels = [row.exam, row.examName, row.exams].flatMap(value => Array.isArray(value) ? value : [value]);
  const examSlugs = ['ssc-cgl', 'ssc-chsl', 'cat'].filter(exam => labels.some(label => typeof label === 'string' && trainingExamPattern(exam).test(label)));
  const q = normalizeQuestion(row);
  const candidate = q ? Object.fromEntries(['id', 'subject', 'topic', 'subtopic', 'concepts', 'difficulty', 'expectedTime', 'targetSource', 'sourceType', 'discrimination'].map(key => [key, q[key]])) : null;
  return {
    trainingMetadataVersion: TRAINING_METADATA_VERSION,
    trainingExamSlugs: examSlugs,
    trainingSubjectSlug: normalizeTrainingSubject(row.subject),
    trainingTopicSlug: trainingSlug(row.topic || row.questionTopic),
    trainingEligible: !!q,
    trainingCandidate: candidate,
  };
}
