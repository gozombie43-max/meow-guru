import { JAM_SECTIONS, JAM_SUBJECT, jamQuestionTopic, type ExamMode } from './exam-mode';
import { QUIZ_TREE, SUBJECT_TOPICS } from './quiz-constants';
import { SUBJECT_OPTIONS, SUBJECT_TOPIC_OPTIONS } from '@/app/(admin)/admin/admin-question-bank-model';

const jamQuizzes = ['PYQ', 'Topic Mix', 'Concept Drill', 'Formula Drill'];
const jamTopics = JAM_SECTIONS.map(section => ({ value: jamQuestionTopic(section.slug), label: section.title }));
const jamTree: typeof QUIZ_TREE = {
  [JAM_SUBJECT]: {
    label: 'IIT JAM Physics',
    topics: Object.fromEntries(jamTopics.map(topic => [topic.value, { label: topic.label, quizzes: jamQuizzes }])),
  },
};
const sscTopics = Object.fromEntries(Object.entries(SUBJECT_TOPIC_OPTIONS).filter(([subject]) => subject !== JAM_SUBJECT));

export function getAdminExamCatalog(mode: ExamMode): {
  subjectOptions: { value: string; label: string }[];
  subjectTopics: Record<string, { value: string; label: string }[]>;
  quizTree: typeof QUIZ_TREE;
  chapters: Record<string, string[]>;
  quizOptions: string[] | null;
} {
  return mode === 'iit-jam' ? {
    subjectOptions: [{ value: JAM_SUBJECT, label: 'IIT JAM Physics' }],
    subjectTopics: { [JAM_SUBJECT]: jamTopics },
    quizTree: jamTree,
    chapters: { [JAM_SUBJECT]: jamTopics.map(topic => topic.value) },
    quizOptions: jamQuizzes,
  } : {
    subjectOptions: SUBJECT_OPTIONS,
    subjectTopics: sscTopics,
    quizTree: QUIZ_TREE,
    chapters: SUBJECT_TOPICS,
    quizOptions: null,
  };
}

export function adminScopedUrl(url: string, mode: ExamMode) {
  const scoped = new URL(url, 'http://admin.local');
  scoped.searchParams.set('examMode', mode);
  return /^https?:\/\//i.test(url) ? scoped.toString() : `${scoped.pathname}${scoped.search}${scoped.hash}`;
}

// A selected destination cannot silently relabel questions from the other bank.
export function prepareAdminQuestion<T extends Record<string, unknown>>(question: T, mode: ExamMode, subject: string, topic: string) {
  const fields = [question.subject, question.quizSubject, question.topic, question.quizTopic, question.exam, question.subjectId, question.topicId].map(value => String(value || ''));
  const hasJam = fields.some(value => /^iit[-_\s]*jam(?:[-_\s]|$)/i.test(value));
  const hasSsc = fields.some(value => /^(?:ssc|rrb|ibps|sbi)(?:[-_\s]|$)/i.test(value)) ||
    [question.subject, question.quizSubject, question.subjectId].some(value => ['logicalreasoning', 'math', 'quant', ...SUBJECT_OPTIONS.map(option => option.value.replace(/[-\s]/g, ''))].includes(String(value || '').toLowerCase().replace(/[-_\s]/g, '')));
  if (mode === 'ssc' ? hasJam : hasSsc) throw new Error('This file contains questions from the other exam mode. Choose the correct bank before uploading.');
  const catalog = getAdminExamCatalog(mode);
  if (!catalog.subjectOptions.some(option => option.value === subject) || !topic) throw new Error('Select a subject and topic for this exam mode.');
  if (mode === 'iit-jam' && !jamTopics.some(option => option.value === topic)) throw new Error('Select an IIT JAM Physics section.');
  return { ...question, subject, topic, quizSubject: subject, quizTopic: topic, ...(mode === 'iit-jam' ? { exam: 'IIT JAM Physics' } : {}) };
}

export function adminTopicLabel(topic: string) {
  return jamTopics.find(option => option.value === topic)?.label || topic;
}
