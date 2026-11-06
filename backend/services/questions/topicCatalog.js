import { JAM_SECTIONS, jamQuestionTopic } from '@meow/contracts/jam';
import { normalizeSearchKey } from './questionNormalizer.js';

// Canonical hub topics per subject. Counts use the same mode resolver as topic pages.
export const SUBJECT_TOPICS = {
  mathematics: [
    'percentages', 'ratio-and-proportion', 'profit-and-loss', 'simple-interest',
    'compound-interest', 'time-and-work', 'time-and-distance', 'algebra', 'geometry',
    'mensuration', 'trigonometry', 'number-system', 'averages', 'discount',
    'mixture-and-alligation', 'partnership', 'square-roots', 'statistics-probability',
    'simplification', 'lcm-and-hcf', 'problems-on-ages', 'pipes-and-cisterns',
    'calendar-and-clock', 'height-and-distance', 'boat-and-stream',
  ],
  reasoning: [
    'coding-decoding', 'syllogism-inferences', 'puzzle-seating-arrangement', 'series',
    'analogy', 'classification-odd-one-out', 'blood-relations', 'direction-distance',
    'venn-diagram', 'inequalities', 'mathematical-symbolic-operations', 'order-ranking',
    'statement-conclusion', 'statement-assumptions', 'statement-arguments',
    'problem-solving-critical-thinking', 'non-verbal-figures', 'paper-folding-cutting',
    'mirror-water-image', 'cube-dice', 'matrix', 'logical-sequence-of-words',
    'emotional-intelligence', 'social-intelligence', 'word-building',
  ],
  english: [
    'synonyms-antonyms', 'one-word-substitution', 'idioms-phrases',
    'spot-the-error-error-detection', 'sentence-correction-improvement', 'cloze-test',
    'reading-comprehension', 'active-passive-voice', 'direct-indirect-narration',
    'tenses', 'subject-verb-agreement', 'para-jumbles', 'fill-in-the-blanks',
    'spelling-misspelled-words', 'prepositions', 'articles', 'conjunctions',
    'homonyms-homophones', 'sentence-structure', 'para-sentence-completion',
    'pronouns', 'modifiers', 'parallelism',
  ],
  'general-awareness': [
    'ancient-history', 'medieval-history', 'modern-history', 'polity', 'geography',
    'physics', 'chemistry', 'biology', 'economy', 'current-affairs', 'static-gk',
  ],
  'iit-jam-physics': JAM_SECTIONS.map(section => jamQuestionTopic(section.slug)),
};

export const PUBLIC_CATALOG_SUBJECTS = ['mathematics', 'reasoning', 'english', 'general-awareness'];

const CANONICAL_SUBJECT_KEYS = new Set(Object.keys(SUBJECT_TOPICS).map(normalizeSearchKey));
const CANONICAL_TOPIC_KEYS = new Set([
  ...Object.values(SUBJECT_TOPICS).flat().map(normalizeSearchKey),
  'antosynopyq',
]);

export function isCanonicalQuestionScope({ subject, topic } = {}) {
  const subjectOk = !subject || CANONICAL_SUBJECT_KEYS.has(normalizeSearchKey(subject));
  if (!subjectOk) return false;
  if (topic) return CANONICAL_TOPIC_KEYS.has(normalizeSearchKey(topic));
  return Boolean(subject);
}
