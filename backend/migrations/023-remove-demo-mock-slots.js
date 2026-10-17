import { EXAM_CONFIGS } from '../config/exam-config.js';

export const id = '023-remove-demo-mock-slots';

// Historical seed identities, used only to remove untouched demo entries.
function generateSlots(examSlug, configKey, tier, count, freeCount) {
  const config = EXAM_CONFIGS[configKey];
  const configName = config ? config.name : examSlug;
  const titleName = tier && configName.includes(tier) ? configName : `${configName}${tier ? ` ${tier}` : ''}`;
  const slugPrefix = examSlug.replace(/-/g, '').slice(0, 6);

  return Array.from({ length: count }, (_, i) => ({
    id: `${slugPrefix}-${tier ? tier.toLowerCase().replace(/\s+/g, '') + '-' : ''}mock-${i + 1}`,
    examSlug,
    configKey,
    title: `${titleName} — Full Mock Test ${i + 1}`,
    tier: tier || undefined,
    isFree: i < freeCount,
    order: i + 1,
  }));
}

const LEGACY_MOCK_TEST_SLOTS = [
  // SSC
  ...generateSlots('ssc-cgl', 'ssc-cgl-tier1', 'Tier I', 8, 2),
  ...generateSlots('ssc-cgl', 'ssc-cgl-tier2', 'Tier II', 5, 1),
  ...generateSlots('ssc-chsl', 'ssc-chsl-tier1', 'Tier I', 8, 2),
  ...generateSlots('ssc-chsl', 'ssc-chsl-tier2', 'Tier II', 5, 1),
  ...generateSlots('ssc-mts', 'ssc-mts', null, 6, 2),
  ...generateSlots('ssc-gd', 'ssc-gd', null, 8, 2),

  // Railway
  ...generateSlots('rrb-ntpc', 'rrb-ntpc-cbt1', 'CBT 1', 8, 2),
  ...generateSlots('rrb-ntpc', 'rrb-ntpc-cbt2', 'CBT 2', 5, 1),
  ...generateSlots('rrb-group-d', 'rrb-group-d', null, 6, 2),
  ...generateSlots('rrb-je', 'rrb-je-cbt1', 'CBT 1', 6, 2),
  ...generateSlots('rrb-je', 'rrb-je-cbt2', 'CBT 2', 4, 1),

  // Banking
  ...generateSlots('ibps-po', 'ibps-po-prelims', 'Prelims', 8, 2),
  ...generateSlots('ibps-po', 'ibps-po-mains', 'Mains', 4, 1),
  ...generateSlots('ibps-clerk', 'ibps-clerk-prelims', 'Prelims', 6, 2),
  ...generateSlots('ibps-clerk', 'ibps-clerk-mains', 'Mains', 4, 1),
  ...generateSlots('sbi-po', 'sbi-po-prelims', 'Prelims', 6, 2),
  ...generateSlots('sbi-po', 'sbi-po-mains', 'Mains', 4, 1),
  ...generateSlots('sbi-clerk', 'sbi-clerk-prelims', 'Prelims', 5, 2),
  ...generateSlots('sbi-clerk', 'sbi-clerk-mains', 'Mains', 4, 1),

  // Management
  ...generateSlots('cat', 'cat', null, 6, 2),

  // Defence
  ...generateSlots('nda', 'nda-math', 'Mathematics', 5, 2),
  ...generateSlots('nda', 'nda-gat', 'General Ability', 5, 2),
  ...generateSlots('cds', 'cds-english', 'English', 4, 2),
  ...generateSlots('cds', 'cds-gk', 'General Knowledge', 4, 2),
  ...generateSlots('cds', 'cds-math', 'Elementary Mathematics', 4, 2),

  // University
  ...generateSlots('cuet', 'cuet', null, 6, 2),

  // UPSC & State PSC
  ...generateSlots('upsc', 'upsc-prelims-gs', 'GS Paper I', 8, 2),
  ...generateSlots('upsc', 'upsc-prelims-csat', 'CSAT Paper II', 6, 2),
  ...generateSlots('uppsc', 'uppsc-prelims-gs', 'GS Paper I', 8, 2),
  ...generateSlots('uppsc', 'uppsc-prelims-csat', 'CSAT Paper II', 5, 1),
  ...generateSlots('wbcs', 'wbcs-prelims', 'Prelims', 8, 2),
  ...generateSlots('wbcs', 'wbcs-mains', 'Mains', 4, 1),
];

export async function up(db) {
  if (await db.collection('schemaMigrations').findOne({ _id: id, completedAt: { $exists: true } })) return;
  await db.collection('mockSlots').deleteMany({
    $and: [
      { $or: LEGACY_MOCK_TEST_SLOTS.map(slot => ({
        id: slot.id, examSlug: slot.examSlug, configKey: slot.configKey,
        title: slot.title, tier: slot.tier ?? null, isFree: slot.isFree, order: slot.order,
      })) },
      { $or: [{ fixedQuestions: null }, { fixedQuestions: { $size: 0 } }] },
    ],
    type: { $in: [null, 'mock'] },
    isPyq: { $ne: true },
    hasFixedPaper: { $ne: true },
    sourcePaper: null,
    paperMetadata: null,
    assessmentMode: { $ne: 'confidential' },
    questionCount: { $in: [null, 0] },
    // An admin edit updates updatedAt; retain those entries for manual review.
    $expr: { $eq: [{ $ifNull: ['$createdAt', null] }, { $ifNull: ['$updatedAt', null] }] },
  });
}
