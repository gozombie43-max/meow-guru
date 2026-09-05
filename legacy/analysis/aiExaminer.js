const { readQuestions } = require('../database/db');

// ─── Helpers ───

function frequency(items) {
  const map = {};
  for (const item of items) {
    if (item) {
      const key = item.trim().toLowerCase();
      if (key) map[key] = (map[key] || 0) + 1;
    }
  }
  return map;
}

function sorted(freqMap) {
  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

function pct(count, total) {
  return total > 0 ? parseFloat(((count / total) * 100).toFixed(1)) : 0;
}

// ─── 1. Concept & Chapter Weightage ───

function analyzeConceptWeightage() {
  const questions = readQuestions();
  const total = questions.length;

  const chapterFreq = frequency(questions.map(q => q.chapter));
  const conceptFreq = frequency(questions.map(q => q.concept));
  const subjectFreq = frequency(questions.map(q => q.subject));

  const chapterWeightage = {};
  for (const [ch, count] of Object.entries(chapterFreq)) {
    chapterWeightage[ch] = { count, percent: pct(count, total) };
  }

  const conceptWeightage = {};
  for (const [c, count] of Object.entries(conceptFreq)) {
    conceptWeightage[c] = { count, percent: pct(count, total) };
  }

  const subjectWeightage = {};
  for (const [s, count] of Object.entries(subjectFreq)) {
    subjectWeightage[s] = { count, percent: pct(count, total) };
  }

  return {
    totalQuestions: total,
    subjectWeightage,
    chapterWeightage,
    conceptWeightage,
    topChapters: sorted(chapterFreq).slice(0, 15),
    topConcepts: sorted(conceptFreq).slice(0, 15)
  };
}

// ─── 2. Common Traps ───

function detectCommonTraps() {
  const questions = readQuestions();
  const total = questions.length;
  const traps = questions.map(q => q.trapType).filter(Boolean);
  const trapFreq = frequency(traps);

  const trapsByDifficulty = {};
  for (const q of questions) {
    if (!q.trapType) continue;
    const diff = (q.difficulty || 'unset').toLowerCase();
    const trap = q.trapType.trim().toLowerCase();
    if (!trapsByDifficulty[diff]) trapsByDifficulty[diff] = {};
    trapsByDifficulty[diff][trap] = (trapsByDifficulty[diff][trap] || 0) + 1;
  }

  const trapsBySubject = {};
  for (const q of questions) {
    if (!q.trapType) continue;
    const subj = (q.subject || 'unknown').toLowerCase();
    const trap = q.trapType.trim().toLowerCase();
    if (!trapsBySubject[subj]) trapsBySubject[subj] = {};
    trapsBySubject[subj][trap] = (trapsBySubject[subj][trap] || 0) + 1;
  }

  return {
    totalWithTraps: traps.length,
    totalWithoutTraps: total - traps.length,
    rankedTraps: sorted(trapFreq),
    trapsByDifficulty,
    trapsBySubject
  };
}

// ─── 3. Formula Clusters ───

function buildFormulaClusters() {
  const questions = readQuestions();
  const withFormula = questions.filter(q => q.formula && q.formula.trim());
  const formulaFreq = frequency(withFormula.map(q => q.formula));

  // Group questions by formula
  const clusters = {};
  for (const q of withFormula) {
    const key = q.formula.trim().toLowerCase();
    if (!clusters[key]) {
      clusters[key] = { formula: q.formula.trim(), count: 0, subjects: new Set(), chapters: new Set(), difficulties: [] };
    }
    clusters[key].count++;
    if (q.subject) clusters[key].subjects.add(q.subject);
    if (q.chapter) clusters[key].chapters.add(q.chapter);
    if (q.difficulty) clusters[key].difficulties.push(q.difficulty);
  }

  // Serialize sets → arrays and compute dominant difficulty
  const formulaClusters = Object.values(clusters)
    .sort((a, b) => b.count - a.count)
    .map(c => {
      const diffFreq = frequency(c.difficulties);
      const dominant = sorted(diffFreq)[0];
      return {
        formula: c.formula,
        count: c.count,
        subjects: [...c.subjects],
        chapters: [...c.chapters],
        dominantDifficulty: dominant ? dominant.name : 'unset'
      };
    });

  return {
    totalWithFormula: withFormula.length,
    totalWithoutFormula: questions.length - withFormula.length,
    formulaClusters
  };
}

// ─── 4. Predict Future Question Types ───

function predictFutureQuestionTypes() {
  const questions = readQuestions();
  const total = questions.length;
  if (total === 0) return { predictions: [], message: 'No questions in dataset.' };

  // Score each (chapter, concept, difficulty) combination by frequency
  const comboFreq = {};
  for (const q of questions) {
    const ch = (q.chapter || '').trim().toLowerCase();
    const co = (q.concept || '').trim().toLowerCase();
    const d  = (q.difficulty || '').trim().toLowerCase();
    if (!ch) continue;

    const key = [ch, co, d].filter(Boolean).join(' | ');
    if (!comboFreq[key]) comboFreq[key] = { chapter: ch, concept: co, difficulty: d, count: 0 };
    comboFreq[key].count++;
  }

  const ranked = Object.values(comboFreq).sort((a, b) => b.count - a.count);

  // High-frequency patterns → most likely to repeat
  const highFreq = ranked.filter(r => r.count >= 2);
  const predictions = (highFreq.length > 0 ? highFreq : ranked.slice(0, 10)).map(r => {
    const label = [r.chapter, r.concept].filter(Boolean).join(' — ');
    return {
      type: label || 'general',
      difficulty: r.difficulty || 'mixed',
      pastFrequency: r.count,
      likelihood: pct(r.count, total)
    };
  });

  // Subject-level prediction
  const subjFreq = frequency(questions.map(q => q.subject));
  const subjectPredictions = sorted(subjFreq).map(s => ({
    subject: s.name,
    expectedPercent: pct(s.count, total)
  }));

  // Difficulty trend
  const diffFreq = frequency(questions.map(q => q.difficulty));
  const difficultyTrend = sorted(diffFreq).map(d => ({
    difficulty: d.name,
    percent: pct(d.count, total)
  }));

  return {
    predictedQuestionTypes: predictions,
    subjectPredictions,
    difficultyTrend
  };
}

// ─── 5. Generate Full Exam Insights Report ───

function generateExamInsights() {
  const weightage = analyzeConceptWeightage();
  const traps = detectCommonTraps();
  const formulas = buildFormulaClusters();
  const predictions = predictFutureQuestionTypes();

  // Build condensed summary maps matching the requested output shape
  const conceptWeightage = {};
  for (const [k, v] of Object.entries(weightage.chapterWeightage)) {
    conceptWeightage[k] = v.percent;
  }

  const commonTraps = traps.rankedTraps.map(t => t.name);

  const formulaClusters = {};
  for (const c of formulas.formulaClusters) {
    formulaClusters[c.formula] = c.count;
  }

  const predictedQuestionTypes = predictions.predictedQuestionTypes.map(p => p.type);

  return {
    totalQuestions: weightage.totalQuestions,

    // Condensed summary (matches requested output shape)
    conceptWeightage,
    commonTraps,
    formulaClusters,
    predictedQuestionTypes,

    // Detailed breakdowns
    detailed: {
      weightage,
      traps,
      formulas,
      predictions
    }
  };
}

module.exports = {
  analyzeConceptWeightage,
  detectCommonTraps,
  buildFormulaClusters,
  predictFutureQuestionTypes,
  generateExamInsights
};
