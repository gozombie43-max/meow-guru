const { readHistory, writeHistory, nextHistoryId } = require('../database/db');

// ─── Save a completed test ───

function saveTestResult(submission) {
  const history = readHistory();

  const entry = {
    id: nextHistoryId(history),
    submittedAt: new Date().toISOString(),
    totalQuestions: submission.answers.length,
    timeLimitSec: submission.timeLimitSec || null,
    answers: submission.answers  // [{ questionId, question, subject, chapter, concept, difficulty, selectedAnswer, correctAnswer, timeSpentSec }]
  };

  history.push(entry);
  writeHistory(history);
  return entry;
}

// ─── Analyze a single test ───

function analyzeTest(testEntry) {
  const answers = testEntry.answers;
  let correct = 0, incorrect = 0, skipped = 0;
  let totalTime = 0;
  const topicStats = {};   // key: "subject > chapter/concept"

  for (const a of answers) {
    const time = a.timeSpentSec || 0;
    totalTime += time;

    const topicKey = [a.subject, a.chapter || a.concept || 'General'].filter(Boolean).join(' > ');

    if (!topicStats[topicKey]) {
      topicStats[topicKey] = { correct: 0, incorrect: 0, skipped: 0, total: 0, totalTime: 0 };
    }
    topicStats[topicKey].total++;
    topicStats[topicKey].totalTime += time;

    if (a.selectedAnswer === null || a.selectedAnswer === undefined) {
      skipped++;
      topicStats[topicKey].skipped++;
    } else if (String(a.selectedAnswer) === String(a.correctAnswer)) {
      correct++;
      topicStats[topicKey].correct++;
    } else {
      incorrect++;
      topicStats[topicKey].incorrect++;
    }
  }

  const total = answers.length;
  const accuracy = total > 0 ? parseFloat(((correct / total) * 100).toFixed(2)) : 0;
  const avgTimeSec = total > 0 ? parseFloat((totalTime / total).toFixed(2)) : 0;

  // Classify topics as strong / weak
  const topics = Object.entries(topicStats).map(([topic, s]) => {
    const topicAccuracy = s.total > 0 ? parseFloat(((s.correct / s.total) * 100).toFixed(2)) : 0;
    const topicAvgTime = s.total > 0 ? parseFloat((s.totalTime / s.total).toFixed(2)) : 0;
    return { topic, ...s, accuracy: topicAccuracy, avgTimeSec: topicAvgTime };
  });

  const strongTopics = topics.filter(t => t.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy);
  const weakTopics   = topics.filter(t => t.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy);

  return {
    testId: testEntry.id,
    submittedAt: testEntry.submittedAt,
    summary: { totalQuestions: total, correct, incorrect, skipped, accuracy, avgTimePerQuestionSec: avgTimeSec, totalTimeSec: parseFloat(totalTime.toFixed(2)) },
    strongTopics,
    weakTopics
  };
}

// ─── Analyze all history (aggregate) ───

function analyzeAll() {
  const history = readHistory();
  if (history.length === 0) {
    return { message: 'No test history found. Take a test first.', tests: 0 };
  }

  // Flatten all answers
  const allAnswers = history.flatMap(t => t.answers);
  let correct = 0, incorrect = 0, skipped = 0, totalTime = 0;
  const topicStats = {};

  for (const a of allAnswers) {
    const time = a.timeSpentSec || 0;
    totalTime += time;

    const topicKey = [a.subject, a.chapter || a.concept || 'General'].filter(Boolean).join(' > ');

    if (!topicStats[topicKey]) {
      topicStats[topicKey] = { correct: 0, incorrect: 0, skipped: 0, total: 0, totalTime: 0 };
    }
    topicStats[topicKey].total++;
    topicStats[topicKey].totalTime += time;

    if (a.selectedAnswer === null || a.selectedAnswer === undefined) {
      skipped++;
      topicStats[topicKey].skipped++;
    } else if (String(a.selectedAnswer) === String(a.correctAnswer)) {
      correct++;
      topicStats[topicKey].correct++;
    } else {
      incorrect++;
      topicStats[topicKey].incorrect++;
    }
  }

  const total = allAnswers.length;
  const accuracy = total > 0 ? parseFloat(((correct / total) * 100).toFixed(2)) : 0;
  const avgTimeSec = total > 0 ? parseFloat((totalTime / total).toFixed(2)) : 0;

  const topics = Object.entries(topicStats).map(([topic, s]) => {
    const topicAccuracy = s.total > 0 ? parseFloat(((s.correct / s.total) * 100).toFixed(2)) : 0;
    const topicAvgTime = s.total > 0 ? parseFloat((s.totalTime / s.total).toFixed(2)) : 0;
    return { topic, ...s, accuracy: topicAccuracy, avgTimeSec: topicAvgTime };
  });

  const strongTopics = topics.filter(t => t.accuracy >= 70).sort((a, b) => b.accuracy - a.accuracy);
  const weakTopics   = topics.filter(t => t.accuracy < 70).sort((a, b) => a.accuracy - b.accuracy);

  // Per-test trend
  const trend = history.map(t => {
    const r = analyzeTest(t);
    return { testId: r.testId, date: r.submittedAt, accuracy: r.summary.accuracy, avgTimeSec: r.summary.avgTimePerQuestionSec, questions: r.summary.totalQuestions };
  });

  return {
    tests: history.length,
    overall: { totalQuestions: total, correct, incorrect, skipped, accuracy, avgTimePerQuestionSec: avgTimeSec },
    strongTopics,
    weakTopics,
    trend
  };
}

module.exports = { saveTestResult, analyzeTest, analyzeAll, readHistory };
