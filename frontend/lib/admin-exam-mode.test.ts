import { expect, it } from 'vitest';
import { adminScopedUrl, getAdminExamCatalog, prepareAdminQuestion } from './admin-exam-mode';

it('provides only Physics and its seven sections for JAM, and only SSC categories otherwise', () => {
  const jam = getAdminExamCatalog('iit-jam');
  expect(jam.subjectOptions.map(option => option.value)).toEqual(['iit-jam-physics']);
  expect(Object.keys(jam.quizTree)).toEqual(['iit-jam-physics']);
  expect(Object.keys(jam.quizTree['iit-jam-physics'].topics)).toHaveLength(7);
  const ssc = getAdminExamCatalog('ssc');
  expect(ssc.subjectOptions.map(option => option.value)).toEqual(['mathematics', 'reasoning', 'english', 'general-awareness']);
  expect(Object.keys(ssc.quizTree)).not.toContain('iit-jam-physics');
  expect(Object.keys(ssc.subjectTopics)).not.toContain('iit-jam-physics');
});

it('rejects cross-bank imports instead of silently reassigning them', () => {
  const jam = { subject: 'iit-jam-physics', topic: 'iit-jam-mechanics' };
  expect(() => prepareAdminQuestion(jam, 'ssc', 'mathematics', 'algebra')).toThrow('other exam mode');
  expect(() => prepareAdminQuestion({ subject: 'Mathematics' }, 'iit-jam', jam.subject, jam.topic)).toThrow('other exam mode');
  expect(() => prepareAdminQuestion({ subjectId: 'english' }, 'iit-jam', jam.subject, jam.topic)).toThrow('other exam mode');
  expect(() => prepareAdminQuestion({}, 'iit-jam', jam.subject, 'algebra')).toThrow('IIT JAM Physics section');
  expect(prepareAdminQuestion({ question: 'Physics MCQ', subject: 'Physics' }, 'iit-jam', jam.subject, jam.topic)).toMatchObject({
    subject: jam.subject, topic: jam.topic, quizSubject: jam.subject, quizTopic: jam.topic, exam: 'IIT JAM Physics',
  });
});

it('preserves URL queries while replacing any previous exam scope', () => {
  expect(adminScopedUrl('/backend-api/api/questions?limit=50&examMode=ssc', 'iit-jam')).toBe('/backend-api/api/questions?limit=50&examMode=iit-jam');
  expect(adminScopedUrl('https://api.example.test/api/questions?limit=1', 'ssc')).toBe('https://api.example.test/api/questions?limit=1&examMode=ssc');
});
