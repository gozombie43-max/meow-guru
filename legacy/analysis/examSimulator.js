const { readQuestions, readHistory, writeHistory, nextHistoryId, shuffle } = require('../database/db');

// ─── SSC Marking Scheme ───
const MARKING = {
  'tier 1': { correct: 2, negative: 0.5 },
  'tier 2': { correct: 2, negative: 0.25 },
  default:  { correct: 2, negative: 0.5 }
};

function getMarks(tier) {
  return MARKING[(tier || '').toLowerCase()] || MARKING.default;
}

// ─── 1. Create Exam ───
//   Builds a randomised paper with hard-question weighting

function createExam({ subject, count = 25, timeLimitMin = 60, tier, hardRatio = 0.4 } = {}) {
  let pool = readQuestions();

  if (subject) {
    pool = pool.filter(q => q.subject && q.subject.toLowerCase() === subject.toLowerCase());
  }

  if (pool.length === 0) {
    return { error: 'Not enough questions in the bank to create an exam.' };
  }

  // Split by difficulty
  const hard   = shuffle(pool.filter(q => q.difficulty === 'hard'));
  const medium = shuffle(pool.filter(q => q.difficulty === 'medium'));
  const easy   = shuffle(pool.filter(q => q.difficulty === 'easy'));
  const rest   = shuffle(pool.filter(q => !['easy', 'medium', 'hard'].includes(q.difficulty)));

  // Fill with hard-question bias
  const target = Math.min(count, pool.length);
  const hardTarget = Math.ceil(target * hardRatio);
  const selected = [];

  // Take hard first
  selected.push(...hard.slice(0, hardTarget));
  // Fill remaining from medium → easy → rest
  const remaining = target - selected.length;
  const fillers = [...medium, ...easy, ...rest];
  selected.push(...fillers.slice(0, remaining));

  // Final shuffle so hard questions aren't all at the top
  const paper = shuffle(selected).slice(0, target);

  return {
    examId: Date.now(),
    totalQuestions: paper.length,
    timeLimitMin,
    tier: tier || 'Tier 1',
    marking: getMarks(tier),
    questions: paper.map(q => ({
      questionId: q.id,
      question: q.question,
      options: q.options,
      subject: q.subject,
      chapter: q.chapter,
      concept: q.concept,
      difficulty: q.difficulty
    })),
    // Internal — needed for evaluation, not sent to client in the route
    _answerKey: new Map(paper.map(q => [q.id, q.correctAnswer]))
  };
}

// ─── 2. Evaluate Exam ───
//   Accepts submitted answers and computes score with negative marking + time

function evaluateExam({ examId, tier, timeLimitMin, answers, timeTakenMin } = {}) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return { error: 'answers must be a non-empty array of { questionId, selectedAnswer }' };
  }

  const questions = readQuestions();
  const qMap = new Map(questions.map(q => [q.id, q]));
  const marks = getMarks(tier);

  let correct = 0, incorrect = 0, skipped = 0;
  let rawScore = 0;
  const maxScore = answers.length * marks.correct;
  const breakdown = [];

  for (const a of answers) {
    const q = qMap.get(a.questionId);
    const correctAnswer = q ? q.correctAnswer : a.correctAnswer;

    if (a.selectedAnswer === null || a.selectedAnswer === undefined || a.selectedAnswer === '') {
      skipped++;
      breakdown.push({ ...a, result: 'skipped', marksAwarded: 0 });
    } else if (String(a.selectedAnswer) === String(correctAnswer)) {
      correct++;
      rawScore += marks.correct;
      breakdown.push({ ...a, result: 'correct', marksAwarded: marks.correct });
    } else {
      incorrect++;
      rawScore -= marks.negative;
      breakdown.push({ ...a, result: 'incorrect', marksAwarded: -marks.negative });
    }
  }

  const totalAttempted = correct + incorrect;
  const accuracy = totalAttempted > 0 ? parseFloat(((correct / totalAttempted) * 100).toFixed(1)) : 0;
  const scorePercent = maxScore > 0 ? parseFloat(((Math.max(0, rawScore) / maxScore) * 100).toFixed(1)) : 0;
  const timeTaken = timeTakenMin != null ? parseFloat(Number(timeTakenMin).toFixed(1)) : null;

  // Persist to test history
  const history = readHistory();
  const entry = {
    id: nextHistoryId(history),
    examId: examId || null,
    submittedAt: new Date().toISOString(),
    totalQuestions: answers.length,
    timeLimitSec: timeLimitMin ? timeLimitMin * 60 : null,
    answers: breakdown.map(b => {
      const q = qMap.get(b.questionId);
      return {
        questionId: b.questionId,
        question: q ? q.question : b.question || '',
        subject: q ? q.subject : b.subject || '',
        chapter: q ? q.chapter : b.chapter || '',
        concept: q ? q.concept : b.concept || '',
        difficulty: q ? q.difficulty : b.difficulty || '',
        selectedAnswer: b.selectedAnswer,
        correctAnswer: q ? q.correctAnswer : b.correctAnswer || '',
        timeSpentSec: b.timeSpentSec || 0
      };
    })
  };
  history.push(entry);
  writeHistory(history);

  return {
    score: parseFloat(rawScore.toFixed(2)),
    maxScore,
    scorePercent,
    accuracy,
    timeTaken: timeTaken !== null ? `${timeTaken} minutes` : 'not recorded',
    summary: {
      total: answers.length,
      attempted: totalAttempted,
      correct,
      incorrect,
      skipped,
      markingScheme: marks
    },
    testHistoryId: entry.id,
    breakdown
  };
}

module.exports = { createExam, evaluateExam };
