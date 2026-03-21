const { readQuestions, readHistory } = require('../database/db');

// ─── Helpers ───

function buildAttemptMap(history) {
  // questionId → [{ selectedAnswer, correctAnswer, timeSpentSec, subject, chapter, concept, difficulty }]
  const map = {};
  for (const test of history) {
    for (const a of test.answers) {
      const id = a.questionId;
      if (!map[id]) map[id] = [];
      map[id].push(a);
    }
  }
  return map;
}

function calcStats(attempts) {
  let correct = 0, incorrect = 0, skipped = 0, totalTime = 0;
  const distractors = {}; // wrong option → count

  for (const a of attempts) {
    totalTime += a.timeSpentSec || 0;

    if (a.selectedAnswer === null || a.selectedAnswer === undefined) {
      skipped++;
    } else if (String(a.selectedAnswer) === String(a.correctAnswer)) {
      correct++;
    } else {
      incorrect++;
      const key = String(a.selectedAnswer);
      distractors[key] = (distractors[key] || 0) + 1;
    }
  }

  const total = attempts.length;
  const accuracy = total > 0 ? parseFloat(((correct / total) * 100).toFixed(2)) : 0;
  const avgTimeSec = total > 0 ? parseFloat((totalTime / total).toFixed(2)) : 0;

  const topDistractors = Object.entries(distractors)
    .sort((a, b) => b[1] - a[1])
    .map(([option, count]) => ({ option, count, percent: parseFloat(((count / total) * 100).toFixed(1)) }));

  return { total, correct, incorrect, skipped, accuracy, avgTimeSec, topDistractors };
}

// ─── Overall question analytics ───

function overviewAnalytics() {
  const questions = readQuestions();
  const history = readHistory();
  const attemptMap = buildAttemptMap(history);

  const questionStats = [];

  for (const q of questions) {
    const attempts = attemptMap[q.id] || [];
    if (attempts.length === 0) continue;
    const stats = calcStats(attempts);
    questionStats.push({
      questionId: q.id,
      question: q.question,
      subject: q.subject,
      chapter: q.chapter,
      concept: q.concept,
      difficulty: q.difficulty,
      ...stats
    });
  }

  if (questionStats.length === 0) {
    return { message: 'No attempt data yet. Take a test first.', questions: 0 };
  }

  // Most missed (lowest accuracy, at least 1 attempt)
  const mostMissed = [...questionStats].sort((a, b) => a.accuracy - b.accuracy).slice(0, 10);

  // Easiest (highest accuracy)
  const easiest = [...questionStats].sort((a, b) => b.accuracy - a.accuracy).slice(0, 10);

  // Slowest (highest avg time)
  const slowest = [...questionStats].sort((a, b) => b.avgTimeSec - a.avgTimeSec).slice(0, 10);

  // Fastest
  const fastest = [...questionStats].sort((a, b) => a.avgTimeSec - b.avgTimeSec).slice(0, 10);

  // Most attempted
  const mostAttempted = [...questionStats].sort((a, b) => b.total - a.total).slice(0, 10);

  // Difficulty accuracy gap: labelled difficulty vs actual accuracy
  const diffGroups = {};
  for (const s of questionStats) {
    const d = s.difficulty || 'unset';
    if (!diffGroups[d]) diffGroups[d] = { totalAccuracy: 0, count: 0 };
    diffGroups[d].totalAccuracy += s.accuracy;
    diffGroups[d].count++;
  }
  const difficultyAccuracy = Object.entries(diffGroups).map(([level, g]) => ({
    level,
    avgAccuracy: parseFloat((g.totalAccuracy / g.count).toFixed(2)),
    questionsAnalyzed: g.count
  }));

  // Subject × difficulty heatmap
  const heatmap = {};
  for (const s of questionStats) {
    const key = `${s.subject}|${s.difficulty || 'unset'}`;
    if (!heatmap[key]) heatmap[key] = { subject: s.subject, difficulty: s.difficulty || 'unset', totalAccuracy: 0, totalTime: 0, count: 0 };
    heatmap[key].totalAccuracy += s.accuracy;
    heatmap[key].totalTime += s.avgTimeSec;
    heatmap[key].count++;
  }
  const accuracyHeatmap = Object.values(heatmap).map(h => ({
    subject: h.subject,
    difficulty: h.difficulty,
    avgAccuracy: parseFloat((h.totalAccuracy / h.count).toFixed(2)),
    avgTimeSec: parseFloat((h.totalTime / h.count).toFixed(2)),
    questions: h.count
  }));

  return {
    totalQuestionsAnalyzed: questionStats.length,
    mostMissed,
    easiest,
    slowest,
    fastest,
    mostAttempted,
    difficultyAccuracy,
    accuracyHeatmap
  };
}

// ─── Single question deep dive ───

function questionDeepDive(questionId) {
  const questions = readQuestions();
  const q = questions.find(x => x.id === questionId);
  if (!q) return null;

  const history = readHistory();
  const attemptMap = buildAttemptMap(history);
  const attempts = attemptMap[questionId] || [];

  if (attempts.length === 0) {
    return {
      questionId: q.id,
      question: q.question,
      subject: q.subject,
      chapter: q.chapter,
      concept: q.concept,
      difficulty: q.difficulty,
      options: q.options,
      correctAnswer: q.correctAnswer,
      attempts: 0,
      message: 'No attempts recorded for this question yet.'
    };
  }

  const stats = calcStats(attempts);

  // Option selection distribution
  const optionDist = {};
  for (const opt of q.options) optionDist[opt] = { count: 0, percent: 0, isCorrect: opt === q.correctAnswer };
  let skippedCount = 0;
  for (const a of attempts) {
    if (a.selectedAnswer === null || a.selectedAnswer === undefined) {
      skippedCount++;
    } else if (optionDist[String(a.selectedAnswer)] !== undefined) {
      optionDist[String(a.selectedAnswer)].count++;
    }
  }
  const total = attempts.length;
  for (const opt of Object.keys(optionDist)) {
    optionDist[opt].percent = parseFloat(((optionDist[opt].count / total) * 100).toFixed(1));
  }

  // Time distribution (buckets: 0-5s, 5-10s, 10-20s, 20-30s, 30s+)
  const timeBuckets = { '0-5s': 0, '5-10s': 0, '10-20s': 0, '20-30s': 0, '30s+': 0 };
  for (const a of attempts) {
    const t = a.timeSpentSec || 0;
    if (t <= 5) timeBuckets['0-5s']++;
    else if (t <= 10) timeBuckets['5-10s']++;
    else if (t <= 20) timeBuckets['10-20s']++;
    else if (t <= 30) timeBuckets['20-30s']++;
    else timeBuckets['30s+']++;
  }

  return {
    questionId: q.id,
    question: q.question,
    subject: q.subject,
    chapter: q.chapter,
    concept: q.concept,
    difficulty: q.difficulty,
    formula: q.formula,
    trapType: q.trapType,
    options: q.options,
    correctAnswer: q.correctAnswer,
    stats,
    optionDistribution: optionDist,
    skipRate: parseFloat(((skippedCount / total) * 100).toFixed(1)),
    timeDistribution: timeBuckets
  };
}

module.exports = { overviewAnalytics, questionDeepDive };
