import { getExamConfig } from '../config/exam-config.js';
import { mockAnswerIndex } from './mockAnswer.js';

export const invalidPaper = message => Object.assign(new Error(message), { statusCode: 422 });
export function validateQuestions(questions) {
  const ids = new Set();
  for (const question of questions) {
    const id = String(question.id || '').trim();
    if (!id || ids.has(id)) throw invalidPaper('Paper question IDs must be nonempty and unique');
    ids.add(id);
    if (!Array.isArray(question.options) || question.options.length < 2 || question.options.length > 8
      || mockAnswerIndex(question.correctAnswer ?? question.answer, question.options) === null) {
      throw invalidPaper(`Question ${id} has invalid options or no valid answer key`);
    }
  }
}
export function validateAssessment(slot, paper, answerKey) {
  const questions = paper.sections.flatMap(section => section.questions.map(question => ({ ...question, correctAnswer: answerKey[question.id] })));
  if (!questions.length) throw invalidPaper('This paper has no questions');
  validateQuestions(questions);
  if (slot.assessmentMode !== 'confidential') return;
  if (!slot.fixedQuestions?.length) throw invalidPaper('Confidential assessments require a fixed paper isolated from the practice bank');
  const config = getExamConfig(slot.configKey);
  for (const section of config.sections) {
    if (paper.sections.find(item => item.key === section.key)?.questions.length !== section.questionCount) {
      throw invalidPaper(`Confidential paper requires exactly ${section.questionCount} questions in ${section.label}`);
    }
  }
  // Confidential exams currently use a single, server-enforced total deadline.
  // A composite policy must be explicit for configs describing sectional timing.
  if (!config.compositeTimer && slot.timingPolicy !== 'composite') {
    throw invalidPaper('Select total-time timing explicitly; sectional exam timing is not supported by this configuration');
  }
}

export function validateConfidentialUpload(slot, questions) {
  if (slot.assessmentMode !== 'confidential') return;
  const config = getExamConfig(slot.configKey);
  if (!config) throw invalidPaper('Unknown exam configuration');
  if (questions.some(question => !config.sections.some(section => section.key === question.sectionKey))) {
    throw invalidPaper('Every confidential question requires a valid sectionKey');
  }
  for (const section of config.sections) {
    if (questions.filter(question => question.sectionKey === section.key).length !== section.questionCount) {
      throw invalidPaper(`Confidential paper requires exactly ${section.questionCount} questions in ${section.label}`);
    }
  }
}
