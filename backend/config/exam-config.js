// Backend mirror of frontend/app/mock-test/_shared/exam-config.ts
// Plain JS (ESM) — same data, no TypeScript types.

// ─── Exam Configs ─────────────────────────────────────────────────

export const EXAM_CONFIGS = {

  // ── SSC ──────────────────────────────────────────────────────────

  'ssc-cgl-tier1': {
    key: 'ssc-cgl-tier1',
    name: 'SSC CGL Tier I',
    compositeTimer: true,
    totalDurationMin: 60,
    sections: [
      { key: 'ga', label: 'General Awareness', questionCount: 25, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['general-awareness', 'general-knowledge'] },
      { key: 'reasoning', label: 'General Intelligence & Reasoning', questionCount: 25, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'quant', label: 'Quantitative Aptitude', questionCount: 25, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['quantitative-aptitude', 'mathematics'] },
      { key: 'english', label: 'English Comprehension', questionCount: 25, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['english'] },
    ],
  },

  'ssc-cgl-tier2': {
    key: 'ssc-cgl-tier2',
    name: 'SSC CGL Tier II',
    compositeTimer: false,
    totalDurationMin: 180,
    sections: [
      { key: 'math', label: 'Mathematical Abilities', questionCount: 30, timeLimitMin: 60, marking: { correct: 3, incorrect: 1 }, topics: ['mathematics', 'quantitative-aptitude'] },
      { key: 'reasoning', label: 'General Intelligence & Reasoning', questionCount: 30, timeLimitMin: 60, marking: { correct: 3, incorrect: 1 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'english', label: 'English Language & Comprehension', questionCount: 45, timeLimitMin: 60, marking: { correct: 3, incorrect: 1 }, topics: ['english'] },
      { key: 'ga', label: 'General Awareness', questionCount: 25, timeLimitMin: 60, marking: { correct: 3, incorrect: 1 }, topics: ['general-awareness', 'general-knowledge'] },
    ],
  },

  'ssc-chsl-tier1': {
    key: 'ssc-chsl-tier1',
    name: 'SSC CHSL Tier I',
    compositeTimer: true,
    totalDurationMin: 60,
    sections: [
      { key: 'ga', label: 'General Awareness', questionCount: 25, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['general-awareness', 'general-knowledge'] },
      { key: 'reasoning', label: 'General Intelligence', questionCount: 25, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'quant', label: 'Quantitative Aptitude', questionCount: 25, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['quantitative-aptitude', 'mathematics'] },
      { key: 'english', label: 'English Language', questionCount: 25, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['english'] },
    ],
  },

  'ssc-chsl-tier2': {
    key: 'ssc-chsl-tier2',
    name: 'SSC CHSL Tier II',
    compositeTimer: false,
    totalDurationMin: 135,
    sections: [
      { key: 'math', label: 'Mathematical Abilities', questionCount: 30, timeLimitMin: 60, marking: { correct: 3, incorrect: 1 }, topics: ['mathematics', 'quantitative-aptitude'] },
      { key: 'reasoning', label: 'Reasoning & General Intelligence', questionCount: 30, timeLimitMin: 60, marking: { correct: 3, incorrect: 1 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'english', label: 'English Language & Comprehension', questionCount: 40, timeLimitMin: 60, marking: { correct: 3, incorrect: 1 }, topics: ['english'] },
      { key: 'ga', label: 'General Awareness', questionCount: 20, timeLimitMin: 60, marking: { correct: 3, incorrect: 1 }, topics: ['general-awareness', 'general-knowledge'] },
    ],
  },

  'ssc-mts': {
    key: 'ssc-mts',
    name: 'SSC MTS',
    compositeTimer: true,
    totalDurationMin: 45,
    sections: [
      { key: 'reasoning', label: 'Numerical & Mathematical Ability', questionCount: 20, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.25 }, topics: ['mathematics', 'quantitative-aptitude'] },
      { key: 'math', label: 'Reasoning & General Intelligence', questionCount: 20, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.25 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'english', label: 'English Language', questionCount: 25, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.25 }, topics: ['english'] },
      { key: 'ga', label: 'General Awareness', questionCount: 25, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.25 }, topics: ['general-awareness', 'general-knowledge'] },
    ],
  },

  'ssc-gd': {
    key: 'ssc-gd',
    name: 'SSC GD Constable',
    compositeTimer: true,
    totalDurationMin: 60,
    sections: [
      { key: 'ga', label: 'General Knowledge & General Awareness', questionCount: 20, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['general-awareness', 'general-knowledge'] },
      { key: 'reasoning', label: 'General Intelligence & Reasoning', questionCount: 20, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'quant', label: 'Elementary Mathematics', questionCount: 20, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['mathematics', 'quantitative-aptitude'] },
      { key: 'english', label: 'English / Hindi', questionCount: 20, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.5 }, topics: ['english'] },
    ],
  },

  // ── Railway ──────────────────────────────────────────────────────

  'rrb-ntpc-cbt1': {
    key: 'rrb-ntpc-cbt1',
    name: 'RRB NTPC CBT 1',
    compositeTimer: true,
    totalDurationMin: 90,
    sections: [
      { key: 'math', label: 'Mathematics', questionCount: 30, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['mathematics', 'quantitative-aptitude'] },
      { key: 'reasoning', label: 'General Intelligence & Reasoning', questionCount: 30, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'ga', label: 'General Awareness', questionCount: 40, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-awareness', 'general-knowledge'] },
    ],
  },

  'rrb-ntpc-cbt2': {
    key: 'rrb-ntpc-cbt2',
    name: 'RRB NTPC CBT 2',
    compositeTimer: true,
    totalDurationMin: 90,
    sections: [
      { key: 'math', label: 'Mathematics', questionCount: 35, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['mathematics', 'quantitative-aptitude'] },
      { key: 'reasoning', label: 'General Intelligence & Reasoning', questionCount: 35, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'ga', label: 'General Awareness', questionCount: 50, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-awareness', 'general-knowledge'] },
    ],
  },

  'rrb-group-d': {
    key: 'rrb-group-d',
    name: 'RRB Group D',
    compositeTimer: true,
    totalDurationMin: 90,
    sections: [
      { key: 'math', label: 'Mathematics', questionCount: 25, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['mathematics', 'quantitative-aptitude'] },
      { key: 'reasoning', label: 'General Intelligence & Reasoning', questionCount: 30, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'gs', label: 'General Science', questionCount: 25, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-science', 'science'] },
      { key: 'ga', label: 'General Awareness & Current Affairs', questionCount: 20, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-awareness', 'current-affairs'] },
    ],
  },

  'rrb-je-cbt1': {
    key: 'rrb-je-cbt1',
    name: 'RRB JE CBT 1',
    compositeTimer: true,
    totalDurationMin: 90,
    sections: [
      { key: 'math', label: 'Mathematics', questionCount: 30, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['mathematics', 'quantitative-aptitude'] },
      { key: 'reasoning', label: 'General Intelligence & Reasoning', questionCount: 25, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'ga', label: 'General Awareness', questionCount: 15, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-awareness', 'general-knowledge'] },
      { key: 'gs', label: 'General Science', questionCount: 30, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-science', 'science'] },
    ],
  },

  'rrb-je-cbt2': {
    key: 'rrb-je-cbt2',
    name: 'RRB JE CBT 2',
    compositeTimer: true,
    totalDurationMin: 120,
    sections: [
      { key: 'ga', label: 'General Awareness', questionCount: 15, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-awareness', 'general-knowledge'] },
      { key: 'gs', label: 'Physics & Chemistry', questionCount: 15, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-science', 'science'] },
      { key: 'computers', label: 'Basics of Computers & Applications', questionCount: 10, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['reasoning', 'computers'] },
      { key: 'technical', label: 'Technical Abilities (Engineering)', questionCount: 100, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['mathematics', 'technical'] },
    ],
  },

  // ── Banking ──────────────────────────────────────────────────────

  'ibps-po-prelims': {
    key: 'ibps-po-prelims',
    name: 'IBPS PO Prelims',
    compositeTimer: false,
    totalDurationMin: 60,
    sections: [
      { key: 'english', label: 'English Language', questionCount: 30, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['english'] },
      { key: 'quant', label: 'Quantitative Aptitude', questionCount: 35, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['quantitative-aptitude', 'mathematics'] },
      { key: 'reasoning', label: 'Reasoning Ability', questionCount: 35, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['reasoning', 'general-intelligence'] },
    ],
  },

  'ibps-po-mains': {
    key: 'ibps-po-mains',
    name: 'IBPS PO Mains',
    compositeTimer: false,
    totalDurationMin: 180,
    sections: [
      { key: 'reasoning', label: 'Reasoning & Computer Aptitude', questionCount: 45, timeLimitMin: 60, marking: { correct: 1.33, incorrect: 0.33 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'ga', label: 'General / Economy / Banking Awareness', questionCount: 40, timeLimitMin: 35, marking: { correct: 1, incorrect: 0.25 }, topics: ['general-awareness', 'current-affairs'] },
      { key: 'english', label: 'English Language', questionCount: 35, timeLimitMin: 40, marking: { correct: 1.14, incorrect: 0.28 }, topics: ['english'] },
      { key: 'quant', label: 'Data Analysis & Interpretation', questionCount: 35, timeLimitMin: 45, marking: { correct: 1.71, incorrect: 0.42 }, topics: ['quantitative-aptitude', 'mathematics'] },
    ],
  },

  'ibps-clerk-prelims': {
    key: 'ibps-clerk-prelims',
    name: 'IBPS Clerk Prelims',
    compositeTimer: false,
    totalDurationMin: 60,
    sections: [
      { key: 'english', label: 'English Language', questionCount: 30, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['english'] },
      { key: 'quant', label: 'Numerical Ability', questionCount: 35, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['quantitative-aptitude', 'mathematics'] },
      { key: 'reasoning', label: 'Reasoning Ability', questionCount: 35, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['reasoning', 'general-intelligence'] },
    ],
  },

  'ibps-clerk-mains': {
    key: 'ibps-clerk-mains',
    name: 'IBPS Clerk Mains',
    compositeTimer: false,
    totalDurationMin: 160,
    sections: [
      { key: 'ga', label: 'General / Financial Awareness', questionCount: 50, timeLimitMin: 35, marking: { correct: 1, incorrect: 0.25 }, topics: ['general-awareness', 'current-affairs'] },
      { key: 'english', label: 'General English', questionCount: 40, timeLimitMin: 35, marking: { correct: 1, incorrect: 0.25 }, topics: ['english'] },
      { key: 'reasoning', label: 'Reasoning Ability & Computer Aptitude', questionCount: 50, timeLimitMin: 45, marking: { correct: 1.2, incorrect: 0.3 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'quant', label: 'Quantitative Aptitude', questionCount: 50, timeLimitMin: 45, marking: { correct: 1, incorrect: 0.25 }, topics: ['quantitative-aptitude', 'mathematics'] },
    ],
  },

  'sbi-po-prelims': {
    key: 'sbi-po-prelims',
    name: 'SBI PO Prelims',
    compositeTimer: false,
    totalDurationMin: 60,
    sections: [
      { key: 'english', label: 'English Language', questionCount: 30, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['english'] },
      { key: 'quant', label: 'Quantitative Aptitude', questionCount: 35, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['quantitative-aptitude', 'mathematics'] },
      { key: 'reasoning', label: 'Reasoning Ability', questionCount: 35, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['reasoning', 'general-intelligence'] },
    ],
  },

  'sbi-po-mains': {
    key: 'sbi-po-mains',
    name: 'SBI PO Mains',
    compositeTimer: false,
    totalDurationMin: 180,
    sections: [
      { key: 'reasoning', label: 'Reasoning & Computer Aptitude', questionCount: 40, timeLimitMin: 50, marking: { correct: 1.25, incorrect: 0.31 }, topics: ['reasoning', 'general-intelligence'] },
      { key: 'quant', label: 'Data Analysis & Interpretation', questionCount: 30, timeLimitMin: 45, marking: { correct: 1.66, incorrect: 0.41 }, topics: ['quantitative-aptitude', 'mathematics'] },
      { key: 'ga', label: 'General / Economy / Banking Awareness', questionCount: 50, timeLimitMin: 45, marking: { correct: 1.2, incorrect: 0.3 }, topics: ['general-awareness', 'current-affairs'] },
      { key: 'english', label: 'English Language', questionCount: 35, timeLimitMin: 40, marking: { correct: 1.14, incorrect: 0.28 }, topics: ['english'] },
    ],
  },

  'sbi-clerk-prelims': {
    key: 'sbi-clerk-prelims',
    name: 'SBI Clerk Prelims',
    compositeTimer: false,
    totalDurationMin: 60,
    sections: [
      { key: 'english', label: 'English Language', questionCount: 30, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['english'] },
      { key: 'quant', label: 'Numerical Ability', questionCount: 35, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['quantitative-aptitude', 'mathematics'] },
      { key: 'reasoning', label: 'Reasoning Ability', questionCount: 35, timeLimitMin: 20, marking: { correct: 1, incorrect: 0.25 }, topics: ['reasoning', 'general-intelligence'] },
    ],
  },

  'sbi-clerk-mains': {
    key: 'sbi-clerk-mains',
    name: 'SBI Clerk Mains',
    compositeTimer: false,
    totalDurationMin: 160,
    sections: [
      { key: 'ga', label: 'General / Financial Awareness', questionCount: 50, timeLimitMin: 35, marking: { correct: 1, incorrect: 0.25 }, topics: ['general-awareness', 'current-affairs'] },
      { key: 'english', label: 'General English', questionCount: 40, timeLimitMin: 35, marking: { correct: 1, incorrect: 0.25 }, topics: ['english'] },
      { key: 'quant', label: 'Quantitative Aptitude', questionCount: 50, timeLimitMin: 45, marking: { correct: 1, incorrect: 0.25 }, topics: ['quantitative-aptitude', 'mathematics'] },
      { key: 'reasoning', label: 'Reasoning Ability & Computer Aptitude', questionCount: 50, timeLimitMin: 45, marking: { correct: 1.2, incorrect: 0.3 }, topics: ['reasoning', 'general-intelligence'] },
    ],
  },

  // ── Management ───────────────────────────────────────────────────

  'cat': {
    key: 'cat',
    name: 'CAT',
    compositeTimer: false,
    totalDurationMin: 120,
    sections: [
      { key: 'varc', label: 'Verbal Ability & Reading Comprehension', questionCount: 24, timeLimitMin: 40, marking: { correct: 3, incorrect: 1 }, topics: ['english', 'verbal-ability', 'reading-comprehension'] },
      { key: 'dilr', label: 'Data Interpretation & Logical Reasoning', questionCount: 20, timeLimitMin: 40, marking: { correct: 3, incorrect: 1 }, topics: ['reasoning', 'data-interpretation', 'logical-reasoning'] },
      { key: 'qa', label: 'Quantitative Ability', questionCount: 22, timeLimitMin: 40, marking: { correct: 3, incorrect: 1 }, topics: ['quantitative-aptitude', 'mathematics'] },
    ],
  },

  // ── Defence ──────────────────────────────────────────────────────

  'nda-math': {
    key: 'nda-math',
    name: 'NDA Mathematics (Paper I)',
    compositeTimer: true,
    totalDurationMin: 150,
    sections: [
      { key: 'math', label: 'Mathematics', questionCount: 120, timeLimitMin: 0, marking: { correct: 2.5, incorrect: 0.83 }, topics: ['mathematics', 'quantitative-aptitude'] },
    ],
  },

  'nda-gat': {
    key: 'nda-gat',
    name: 'NDA General Ability (Paper II)',
    compositeTimer: true,
    totalDurationMin: 150,
    sections: [
      { key: 'english', label: 'English', questionCount: 50, timeLimitMin: 0, marking: { correct: 4, incorrect: 1.33 }, topics: ['english'] },
      { key: 'gk', label: 'General Knowledge & Science', questionCount: 100, timeLimitMin: 0, marking: { correct: 4, incorrect: 1.33 }, topics: ['general-knowledge', 'general-science', 'general-awareness'] },
    ],
  },

  'cds-english': {
    key: 'cds-english',
    name: 'CDS English (Paper I)',
    compositeTimer: true,
    totalDurationMin: 120,
    sections: [
      { key: 'english', label: 'English', questionCount: 120, timeLimitMin: 0, marking: { correct: 0.83, incorrect: 0.27 }, topics: ['english'] },
    ],
  },

  'cds-gk': {
    key: 'cds-gk',
    name: 'CDS General Knowledge (Paper II)',
    compositeTimer: true,
    totalDurationMin: 120,
    sections: [
      { key: 'ga', label: 'General Knowledge & Awareness', questionCount: 120, timeLimitMin: 0, marking: { correct: 0.83, incorrect: 0.27 }, topics: ['general-awareness', 'general-knowledge', 'general-science'] },
    ],
  },

  'cds-math': {
    key: 'cds-math',
    name: 'CDS Elementary Mathematics (Paper III)',
    compositeTimer: true,
    totalDurationMin: 120,
    sections: [
      { key: 'math', label: 'Elementary Mathematics', questionCount: 100, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['mathematics', 'quantitative-aptitude'] },
    ],
  },

  // ── University ───────────────────────────────────────────────────

  'cuet': {
    key: 'cuet',
    name: 'CUET',
    compositeTimer: false,
    totalDurationMin: 135,
    sections: [
      { key: 'english', label: 'English Language', questionCount: 50, timeLimitMin: 45, marking: { correct: 5, incorrect: 1 }, topics: ['english'] },
      { key: 'ga', label: 'General Test', questionCount: 50, timeLimitMin: 45, marking: { correct: 5, incorrect: 1 }, topics: ['general-awareness', 'general-knowledge', 'quantitative-aptitude', 'reasoning'] },
      { key: 'domain', label: 'Domain Subject', questionCount: 50, timeLimitMin: 45, marking: { correct: 5, incorrect: 1 }, topics: ['general-science', 'mathematics'] },
    ],
  },

  // ── UPSC & State PSC ──────────────────────────────────────────────

  'upsc-prelims-gs': {
    key: 'upsc-prelims-gs',
    name: 'UPSC CSE Prelims GS 1',
    compositeTimer: true,
    totalDurationMin: 120,
    sections: [
      { key: 'gs', label: 'General Studies (Paper I)', questionCount: 100, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.66 }, topics: ['general-awareness', 'polity', 'history', 'geography', 'economics', 'general-science', 'current-affairs'] },
    ],
  },

  'upsc-prelims-csat': {
    key: 'upsc-prelims-csat',
    name: 'UPSC CSE Prelims CSAT',
    compositeTimer: true,
    totalDurationMin: 120,
    sections: [
      { key: 'csat', label: 'CSAT / Aptitude (Paper II)', questionCount: 80, timeLimitMin: 0, marking: { correct: 2.5, incorrect: 0.83 }, topics: ['reasoning', 'quantitative-aptitude', 'mathematics', 'english', 'reading-comprehension'] },
    ],
  },

  'uppsc-prelims-gs': {
    key: 'uppsc-prelims-gs',
    name: 'UPPSC PCS Prelims GS 1',
    compositeTimer: true,
    totalDurationMin: 120,
    sections: [
      { key: 'gs', label: 'General Studies (Paper I)', questionCount: 150, timeLimitMin: 0, marking: { correct: 1.33, incorrect: 0.44 }, topics: ['general-awareness', 'polity', 'history', 'geography', 'economics', 'general-science', 'current-affairs'] },
    ],
  },

  'uppsc-prelims-csat': {
    key: 'uppsc-prelims-csat',
    name: 'UPPSC PCS Prelims CSAT',
    compositeTimer: true,
    totalDurationMin: 120,
    sections: [
      { key: 'csat', label: 'General Studies (Paper II - CSAT)', questionCount: 100, timeLimitMin: 0, marking: { correct: 2, incorrect: 0.66 }, topics: ['reasoning', 'quantitative-aptitude', 'mathematics', 'english', 'general-awareness'] },
    ],
  },

  'wbcs-prelims': {
    key: 'wbcs-prelims',
    name: 'WBCS (Exe) Prelims',
    compositeTimer: true,
    totalDurationMin: 150,
    sections: [
      { key: 'gs', label: 'General Studies & Mental Ability', questionCount: 200, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-awareness', 'english', 'history', 'geography', 'polity', 'economics', 'reasoning', 'general-science'] },
    ],
  },

  'wbcs-mains': {
    key: 'wbcs-mains',
    name: 'WBCS (Exe) Mains',
    compositeTimer: true,
    totalDurationMin: 180,
    sections: [
      { key: 'gs', label: 'General Studies Compulsory Papers', questionCount: 200, timeLimitMin: 0, marking: { correct: 1, incorrect: 0.33 }, topics: ['general-awareness', 'history', 'geography', 'polity', 'economics', 'general-science', 'reasoning'] },
    ],
  },
};

// ─── Mock Test Slots ──────────────────────────────────────────────

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

export const MOCK_TEST_SLOTS = [
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

// ─── Previous Year Question (PYQ) Slots ────────────────────────────

const PYQ_YEARS = [2024, 2023, 2022, 2021, 2020];

function generatePyqSlots(examSlug, configKey, tier, count = 4, freeCount = 1) {
  const config = EXAM_CONFIGS[configKey];
  const configName = config ? config.name : examSlug;
  const titleName = tier && configName.includes(tier) ? configName : `${configName}${tier ? ` ${tier}` : ''}`;
  const slugPrefix = examSlug.replace(/-/g, '').slice(0, 6);
  const tierPrefix = tier ? tier.toLowerCase().replace(/\s+/g, '') + '-' : '';

  return Array.from({ length: count }, (_, i) => {
    const year = PYQ_YEARS[i % PYQ_YEARS.length];
    const shift = i % 2 === 0 ? 'Shift 1' : 'Shift 2';
    return {
      id: `${slugPrefix}-${tierPrefix}pyq-${year}-${i + 1}`,
      examSlug,
      configKey,
      title: `${titleName} — ${year} Official PYQ Paper (${shift})`,
      tier: tier || undefined,
      isFree: i < freeCount,
      order: i + 1,
      isPyq: true,
      year,
      shift,
    };
  });
}

export const PYQ_TEST_SLOTS = [
  // SSC
  ...generatePyqSlots('ssc-cgl', 'ssc-cgl-tier1', 'Tier I', 5, 2),
  ...generatePyqSlots('ssc-cgl', 'ssc-cgl-tier2', 'Tier II', 4, 1),
  ...generatePyqSlots('ssc-chsl', 'ssc-chsl-tier1', 'Tier I', 5, 2),
  ...generatePyqSlots('ssc-chsl', 'ssc-chsl-tier2', 'Tier II', 4, 1),
  ...generatePyqSlots('ssc-mts', 'ssc-mts', null, 5, 2),
  ...generatePyqSlots('ssc-gd', 'ssc-gd', null, 5, 2),

  // Railway
  ...generatePyqSlots('rrb-ntpc', 'rrb-ntpc-cbt1', 'CBT 1', 5, 2),
  ...generatePyqSlots('rrb-ntpc', 'rrb-ntpc-cbt2', 'CBT 2', 4, 1),
  ...generatePyqSlots('rrb-group-d', 'rrb-group-d', null, 5, 2),
  ...generatePyqSlots('rrb-je', 'rrb-je-cbt1', 'CBT 1', 5, 2),
  ...generatePyqSlots('rrb-je', 'rrb-je-cbt2', 'CBT 2', 4, 1),

  // Banking
  ...generatePyqSlots('ibps-po', 'ibps-po-prelims', 'Prelims', 5, 2),
  ...generatePyqSlots('ibps-po', 'ibps-po-mains', 'Mains', 4, 1),
  ...generatePyqSlots('ibps-clerk', 'ibps-clerk-prelims', 'Prelims', 5, 2),
  ...generatePyqSlots('ibps-clerk', 'ibps-clerk-mains', 'Mains', 4, 1),
  ...generatePyqSlots('sbi-po', 'sbi-po-prelims', 'Prelims', 5, 2),
  ...generatePyqSlots('sbi-po', 'sbi-po-mains', 'Mains', 4, 1),
  ...generatePyqSlots('sbi-clerk', 'sbi-clerk-prelims', 'Prelims', 5, 2),
  ...generatePyqSlots('sbi-clerk', 'sbi-clerk-mains', 'Mains', 4, 1),

  // Civil Services / State PSC
  ...generatePyqSlots('upsc', 'upsc-prelims-gs', 'GS Paper I', 5, 2),
  ...generatePyqSlots('upsc', 'upsc-prelims-csat', 'CSAT Paper II', 4, 1),
  ...generatePyqSlots('uppsc', 'uppsc-prelims-gs', 'GS Paper I', 5, 2),
  ...generatePyqSlots('uppsc', 'uppsc-prelims-csat', 'CSAT Paper II', 4, 1),
  ...generatePyqSlots('wbcs', 'wbcs-prelims', 'Prelims', 5, 2),
  ...generatePyqSlots('wbcs', 'wbcs-mains', 'Mains', 4, 1),

  // Defence
  ...generatePyqSlots('nda', 'nda-math', 'Mathematics', 4, 1),
  ...generatePyqSlots('nda', 'nda-gat', 'General Ability', 4, 1),
  ...generatePyqSlots('cds', 'cds-english', 'English', 4, 1),
  ...generatePyqSlots('cds', 'cds-gk', 'General Knowledge', 4, 1),
  ...generatePyqSlots('cds', 'cds-math', 'Elementary Mathematics', 4, 1),

  // Management / University
  ...generatePyqSlots('cat', 'cat', null, 5, 2),
  ...generatePyqSlots('cuet', 'cuet', null, 5, 2),
];

// ─── Helpers ──────────────────────────────────────────────────────

export function getExamConfig(configKey) {
  return EXAM_CONFIGS[configKey] || null;
}

export function getSlotById(slotId) {
  return MOCK_TEST_SLOTS.find(s => s.id === slotId) || PYQ_TEST_SLOTS.find(s => s.id === slotId) || null;
}

export function getSlotsForExam(examSlug) {
  return MOCK_TEST_SLOTS.filter(s => s.examSlug === examSlug);
}

export function getPyqSlotsForExam(examSlug) {
  return PYQ_TEST_SLOTS.filter(s => s.examSlug === examSlug);
}

export function getAllSlotsForExam(examSlug) {
  return [
    ...MOCK_TEST_SLOTS.filter(s => s.examSlug === examSlug),
    ...PYQ_TEST_SLOTS.filter(s => s.examSlug === examSlug),
  ];
}

export function getTotalQuestions(configKey) {
  const config = EXAM_CONFIGS[configKey];
  if (!config) return 0;
  return config.sections.reduce((sum, s) => sum + s.questionCount, 0);
}

export function getMaxMarks(configKey) {
  const config = EXAM_CONFIGS[configKey];
  if (!config) return 0;
  return config.sections.reduce((sum, s) => sum + s.questionCount * s.marking.correct, 0);
}
