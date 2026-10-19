import { examPaperSchema, paperPresentation } from '@meow/contracts/exam-paper';
import { getMockSlotsCollection } from '../../config/mongodb.js';
import { invalidPaper } from '../assessmentPolicy.js';
import { mutateMockCatalog } from '../../repositories/mockCatalogMetadataRepository.js';

export async function uploadSchemaPaper({ slotData, paper, examMode }) {
  const result = examPaperSchema.safeParse(paper);
  if (!result.success) throw invalidPaper(result.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  if (examMode && examMode !== 'ssc') throw invalidPaper('SSC papers must be uploaded in SSC mode');
  const sourcePaper = result.data;
  const examSlug = sourcePaper.exam.toLowerCase().replace('_', '-');
  if (slotData?.examSlug && slotData.examSlug !== examSlug) throw invalidPaper('The selected exam does not match the paper');
  if (!slotData?.id || !slotData?.title) throw invalidPaper('Paper slot id and title are required');
  const slots = getMockSlotsCollection();
  const existing = await slots.findOne({ id: String(slotData.id), examSlug }, { projection: { createdAt: 1, assessmentMode: 1 } });
  if (existing?.assessmentMode === 'confidential' && slotData.assessmentMode !== 'confidential') throw invalidPaper('A confidential paper cannot be republished as practice');
  const presentation = paperPresentation(sourcePaper);
  const { sections, ...metadata } = presentation;
  // Catalog metadata contains no question content, answer keys or solutions.
  const paperMetadata = { ...metadata, sections: sections.map(({ questions: _questions, ...section }) => section) };
  const now = new Date().toISOString();
  const slot = {
    id: String(slotData.id), title: String(slotData.title), examSlug,
    configKey: `${examSlug}-tier${sourcePaper.tier}`, tier: sourcePaper.tier === 1 ? 'Tier I' : 'Tier II',
    type: sourcePaper.type.toLowerCase(), isPyq: sourcePaper.type === 'PYQ',
    isFree: Boolean(slotData.isFree), order: Number(slotData.order) || 1,
    assessmentMode: slotData.assessmentMode === 'confidential' ? 'confidential' : 'practice',
    sourcePaper, paperMetadata, hasFixedPaper: true,
    questionCount: sections.reduce((sum, section) => sum + section.questionCount, 0),
    examDate: sourcePaper.examDate ?? null, shift: sourcePaper.shift ?? null,
    year: sourcePaper.examDate ? Number(sourcePaper.examDate.slice(0, 4)) : null,
    createdAt: existing?.createdAt || now, updatedAt: now,
  };
  // This schema is isolated from the topic-practice question bank.
  await mutateMockCatalog(examSlug, (collection, options) => collection.updateOne({ id: slot.id, examSlug }, { $set: slot, $unset: { fixedQuestions: '' } }, { ...options, upsert: true }));
  return { success: true, slotId: slot.id, title: slot.title, examSlug, type: slot.type, tier: slot.tier,
    totalQuestions: slot.questionCount, insertedToBank: 0, isNewSlot: !existing };
}

export function buildSchemaPaper(source) {
  const paper = examPaperSchema.parse(source);
  return {
    clientPaper: paperPresentation(paper),
    answerKey: Object.fromEntries(Object.values(paper.sections).flatMap(section => section.questions.map(q => [q.id, q.answer]))),
  };
}
