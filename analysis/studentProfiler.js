const { readHistory } = require('../database/db');

// ─── Helpers ───

function flattenAnswers() {
  const history = readHistory();
  return history.flatMap(t => t.answers);
}

function isCorrect(a) {
  if (a.selectedAnswer === null || a.selectedAnswer === undefined) return false;
  return String(a.selectedAnswer) === String(a.correctAnswer);
}

// Derive a concept key from the answer — fall back to chapter if concept is empty
function conceptKey(a) {
  const c = (a.concept || '').trim();
  if (c) return c.toLowerCase();
  const ch = (a.chapter || '').trim();
  return ch ? ch.toLowerCase() : 'general';
}

// Difficulty weight: harder correct answers count more toward mastery
const DIFF_WEIGHT = { easy: 1, medium: 1.5, hard: 2 };

// ─── 1. Concept Accuracy ───

function calculateConceptAccuracy() {
  const answers = flattenAnswers();
  const map = {}; // concept → { correct, total, totalTime, difficulties[] }

  for (const a of answers) {
    const key = conceptKey(a);
    if (!map[key]) map[key] = { correct: 0, incorrect: 0, skipped: 0, total: 0, totalTime: 0 };
    map[key].total++;
    map[key].totalTime += a.timeSpentSec || 0;

    if (a.selectedAnswer === null || a.selectedAnswer === undefined) {
      map[key].skipped++;
    } else if (isCorrect(a)) {
      map[key].correct++;
    } else {
      map[key].incorrect++;
    }
  }

  const concepts = Object.entries(map).map(([concept, s]) => {
    const accuracy = s.total > 0 ? parseFloat(((s.correct / s.total) * 100).toFixed(1)) : 0;
    const avgTime = s.total > 0 ? parseFloat((s.totalTime / s.total).toFixed(2)) : 0;
    return { concept, ...s, accuracy, avgTimeSec: avgTime };
  });

  return concepts.sort((a, b) => b.accuracy - a.accuracy);
}

// ─── 2. Weak Concepts ───

function detectWeakConcepts(threshold = 60) {
  const concepts = calculateConceptAccuracy();
  const weak = concepts.filter(c => c.accuracy < threshold);
  const strong = concepts.filter(c => c.accuracy >= threshold);
  return { strong, weak, threshold };
}

// ─── 3. Student Profile ───

function generateStudentProfile() {
  const answers = flattenAnswers();

  if (answers.length === 0) {
    return {
      strongConcepts: [],
      weakConcepts: [],
      masteryScore: 0,
      message: 'No test history yet. Take a test first.'
    };
  }

  const { strong, weak } = detectWeakConcepts();

  // Mastery score: weighted accuracy across all answers
  let weightedCorrect = 0;
  let weightedTotal = 0;

  for (const a of answers) {
    const w = DIFF_WEIGHT[(a.difficulty || 'easy').toLowerCase()] || 1;
    weightedTotal += w;
    if (isCorrect(a)) weightedCorrect += w;
  }

  const masteryScore = weightedTotal > 0
    ? parseFloat(((weightedCorrect / weightedTotal) * 100).toFixed(1))
    : 0;

  // Concept-level accuracy map
  const conceptAccuracy = {};
  for (const c of [...strong, ...weak]) {
    conceptAccuracy[c.concept] = c.accuracy;
  }

  return {
    strongConcepts: strong.map(c => c.concept),
    weakConcepts: weak.map(c => c.concept),
    masteryScore,
    totalAnswered: answers.length,
    conceptAccuracy,
    details: {
      strongDetails: strong,
      weakDetails: weak
    }
  };
}

module.exports = {
  calculateConceptAccuracy,
  detectWeakConcepts,
  generateStudentProfile
};
