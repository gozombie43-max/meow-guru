import { z } from 'zod';
import { examPaperSchema } from '@meow/contracts/exam-paper';
import { getMockSlotsCollection } from '../../config/mongodb.js';
import { parseQuestionExamMode } from '../questions/questionExamMode.js';
import { validateQuestions, validateConfidentialUpload } from '../assessmentPolicy.js';
import { mockAnswerIndex } from '../mockAnswer.js';

const failure = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const optionText = value => value && typeof value === 'object' ? String(value.text ?? value.value ?? '') : String(value ?? '');
const containsImage = value => /!\[[^\]]*\]\([^)]+\)|\/api\/upload\/image\/|(?:https?:\/\/|\/(?:images|pyq-assets)\/)[^\s)]+\.(?:png|jpe?g|webp|gif|svg)(?:[?#\s)]|$)/i.test(optionText(value));
const language = z.object({ question: z.string(), options: z.array(z.string()).min(2).max(8), solution: z.string() });
const editSchema = z.object({
  id: z.string().min(1), question: z.string(), options: z.array(z.string()).max(8),
  correctAnswer: z.union([z.string(), z.number(), z.array(z.union([z.string(), z.number()])), z.object({ min: z.number(), max: z.number() })]),
  solution: z.string(), questionImage: z.string().refine(value => !value || /^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value), 'Use an HTTP image URL or an absolute image path').nullable(),
  translations: z.object({ bn: language }).optional(),
}).strict().refine(q => q.question.trim() || q.questionImage, 'Add question text or a question image');
const saveSchema = z.object({ expectedUpdatedAt: z.string().nullable(), edits: z.array(editSchema).min(1).max(1000) });

async function loadSlot(examSlug, slotId, examMode) {
  const mode = parseQuestionExamMode(examMode);
  if (!mode || !examSlug || String(examSlug).startsWith('iit-jam') !== (mode === 'iit-jam')) throw failure(400, 'Choose a paper from the current exam mode');
  const slot = await getMockSlotsCollection().findOne({ id: slotId, examSlug });
  if (!slot) throw failure(404, 'Paper not found');
  if (!slot.sourcePaper && !slot.fixedQuestions?.length) throw failure(422, 'This is a dynamic slot. Upload a fixed paper before editing questions.');
  return slot;
}

function editableQuestions(slot) {
  if (slot.sourcePaper) return Object.entries(slot.sourcePaper.sections).flatMap(([sectionKey, section]) => section.questions.map(q => ({
    id: q.id, sectionKey, questionType: 'MCQ', question: q.question.en, options: q.options.en,
    correctAnswer: 'ABCD'.indexOf(q.answer), solution: q.solution.en, questionImage: q.questionImage || null,
    translations: { bn: { question: q.question.bn, options: q.options.bn, solution: q.solution.bn } },
  })));
  return slot.fixedQuestions.map(q => {
    const questionType = q.questionType || 'MCQ';
    const key = q.correctAnswer ?? q.answer;
    const answerIndex = answer => {
      const index = mockAnswerIndex(answer, q.options);
      return index === null ? answer : index;
    };
    return { id: q.id, sectionKey: q.sectionKey, questionType, question: q.question || '',
      options: (q.options || []).map(optionText), correctAnswer: questionType === 'NAT' ? key : questionType === 'MSQ' ? (Array.isArray(key) ? key.map(answerIndex) : []) : answerIndex(key),
      solution: q.solution || q.explanation || '', questionImage: q.questionImage || q.image || null };
  });
}

export async function fetchAdminPaperQuestions(examSlug, slotId, examMode) {
  const slot = await loadSlot(examSlug, slotId, examMode);
  const optionImageStatus = Object.fromEntries(slot.sourcePaper
    ? Object.values(slot.sourcePaper.sections).flatMap(section => section.questions.map(q => [q.id, { en: q.options.en.map(containsImage), bn: q.options.bn.map(containsImage) }]))
    : slot.fixedQuestions.map(q => [q.id, { en: (q.options || []).map((option, index) => Boolean(option?.image || q.optionImages?.[index] || containsImage(option))) }]));
  return { title: slot.title, updatedAt: slot.updatedAt || null, questions: editableQuestions(slot), optionImageStatus };
}

export async function saveAdminPaperQuestions(examSlug, slotId, examMode, input, { validateOnly = false, replaceOptionImages = [] } = {}) {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) throw failure(422, parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  const { expectedUpdatedAt, edits } = parsed.data;
  const slot = await loadSlot(examSlug, slotId, examMode);
  if ((slot.updatedAt || null) !== expectedUpdatedAt) throw failure(409, 'This paper changed since you opened it. Reload the paper before saving.');
  const ids = new Set(editableQuestions(slot).map(q => q.id));
  const changes = new Map();
  for (const edit of edits) {
    if (!ids.has(edit.id) || changes.has(edit.id)) throw failure(422, 'Question IDs must be unique and belong to this paper');
    changes.set(edit.id, edit);
  }
  const applyImage = (question, edit) => {
    const next = { ...question, questionImage: edit.questionImage || null };
    if ((question.questionImage || question.image || null) !== next.questionImage) {
      delete next.questionImageWidth; delete next.questionImageHeight;
    }
    // Older papers sometimes use image instead of questionImage.
    if ('image' in next) delete next.image;
    return next;
  };
  let updates;
  if (slot.sourcePaper) {
    const source = { ...slot.sourcePaper, sections: Object.fromEntries(Object.entries(slot.sourcePaper.sections).map(([key, section]) => [key, {
      ...section, questions: section.questions.map(q => {
        const edit = changes.get(q.id);
        if (!edit) return q;
        return { ...applyImage(q, edit), question: { ...q.question, en: edit.question, bn: edit.translations?.bn.question ?? q.question.bn },
          options: { ...q.options, en: edit.options, bn: edit.translations?.bn.options ?? q.options.bn },
          solution: { ...q.solution, en: edit.solution, bn: edit.translations?.bn.solution ?? q.solution.bn }, answer: typeof edit.correctAnswer === 'number' ? 'ABCD'[edit.correctAnswer] : edit.correctAnswer };
      }),
    }])) };
    const result = examPaperSchema.safeParse(source);
    if (!result.success) throw failure(422, result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
    updates = { sourcePaper: result.data };
  } else {
    const fixedQuestions = slot.fixedQuestions.map(q => {
      const edit = changes.get(q.id);
      if (!edit) return q;
      if (edit.options.length !== (q.options || []).length) throw failure(422, 'Keep the existing number of options');
      if (edit.options.some(option => !option.trim())) throw failure(422, `Question ${q.id}: provide text or image markdown for every option`);
      const next = { ...applyImage(q, edit), question: edit.question, solution: edit.solution, correctAnswer: edit.correctAnswer,
        options: edit.options.map((text, index) => typeof q.options[index] === 'object' ? { ...q.options[index], text } : text) };
      for (const target of replaceOptionImages.filter(target => target.id === q.id)) {
        if (typeof next.options[target.index] === 'object') delete next.options[target.index].image;
        if (Array.isArray(next.optionImages)) {
          next.optionImages = [...next.optionImages]; next.optionImages[target.index] = null;
        }
      }
      return next;
    });
    validateQuestions(fixedQuestions);
    validateConfidentialUpload(slot, fixedQuestions);
    updates = { fixedQuestions };
  }
  if (validateOnly) return { valid: true, savedQuestions: edits.length };
  const updatedAt = new Date(Math.max(Date.now(), Date.parse(slot.updatedAt || '') + 1 || 0)).toISOString();
  const result = await getMockSlotsCollection().updateOne({ id: slotId, examSlug, updatedAt: slot.updatedAt === undefined ? { $exists: false } : slot.updatedAt }, { $set: { ...updates, updatedAt } });
  if (!result.matchedCount) throw failure(409, 'This paper changed while saving. Reload the paper before saving.');
  return { success: true, updatedAt, savedQuestions: edits.length };
}
