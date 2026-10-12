export type ExamMode = 'ssc' | 'iit-jam';
export const EXAM_MODE_KEY = 'study-guru:exam-mode';
export const JAM_SUBJECT = 'iit-jam-physics';
// Physics syllabus: https://jam2026.iitb.ac.in/files/syllabus_PH.pdf
export { JAM_SECTIONS, jamQuestionTopic } from '@meow/contracts/jam';
export const jamSectionHref = (slug: string) => `/subjects/${JAM_SUBJECT}/${slug}`;
export const isJamContent = (value: string) => /iit-jam|iit jam/i.test(value);
