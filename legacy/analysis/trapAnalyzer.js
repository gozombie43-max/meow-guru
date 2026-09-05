const { readQuestions, readHistory } = require('../database/db');

// ─── Helpers ───

function lower(v) {
  return (v || '').trim().toLowerCase();
}

function sorted(freqMap) {
  return Object.entries(freqMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));
}

// ─── Core: build trap stats from questions + test history ───

function analyzeTrapFrequency() {
  const questions = readQuestions();
  const history = readHistory();
  const total = questions.length;

  // 1. Trap frequency from question bank
  const trapFreq = {};
  for (const q of questions) {
    const trap = lower(q.trapType);
    if (trap) trapFreq[trap] = (trapFreq[trap] || 0) + 1;
  }

  // 2. Trap × concept matrix
  const trapByConcept = {};
  for (const q of questions) {
    const trap = lower(q.trapType);
    if (!trap) continue;
    const concept = lower(q.concept) || lower(q.chapter) || 'general';
    if (!trapByConcept[concept]) trapByConcept[concept] = {};
    trapByConcept[concept][trap] = (trapByConcept[concept][trap] || 0) + 1;
  }

  // 3. Cross-reference with test history to find hardest trap (lowest accuracy)
  const trapAccuracy = {}; // trap → { correct, total }
  const allAnswers = history.flatMap(t => t.answers);

  // Build questionId → trapType lookup
  const qMap = new Map(questions.map(q => [q.id, q]));

  for (const a of allAnswers) {
    const q = qMap.get(a.questionId);
    if (!q) continue;
    const trap = lower(q.trapType);
    if (!trap) continue;

    if (!trapAccuracy[trap]) trapAccuracy[trap] = { correct: 0, incorrect: 0, skipped: 0, total: 0 };
    trapAccuracy[trap].total++;

    if (a.selectedAnswer === null || a.selectedAnswer === undefined) {
      trapAccuracy[trap].skipped++;
    } else if (String(a.selectedAnswer) === String(a.correctAnswer)) {
      trapAccuracy[trap].correct++;
    } else {
      trapAccuracy[trap].incorrect++;
    }
  }

  // Determine hardest trap: lowest accuracy among traps that have attempts
  const trapStats = Object.entries(trapAccuracy).map(([trap, s]) => ({
    trap,
    accuracy: s.total > 0 ? parseFloat(((s.correct / s.total) * 100).toFixed(1)) : null,
    ...s
  }));
  trapStats.sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100));

  // If no attempts exist, fall back to most frequent trap
  const hardestTrap = trapStats.length > 0
    ? trapStats[0].trap
    : (sorted(trapFreq)[0]?.name || null);

  // Condensed output matching requested shape
  const trapFrequencyMap = {};
  for (const [k, v] of Object.entries(trapFreq)) trapFrequencyMap[k] = v;

  return {
    trapFrequency: trapFrequencyMap,
    hardestTrap,
    totalQuestionsWithTraps: Object.values(trapFreq).reduce((s, c) => s + c, 0),
    totalQuestions: total,
    rankedTraps: sorted(trapFreq),
    trapByConcept,
    trapPerformance: trapStats
  };
}

module.exports = { analyzeTrapFrequency };
