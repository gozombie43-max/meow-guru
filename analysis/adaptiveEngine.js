const { readHistory } = require('../database/db');

const LEVELS = ['easy', 'medium', 'hard'];
const STREAK_UP = 3;   // correct in a row to increase
const STREAK_DOWN = 2; // wrong in a row to decrease

// ─── Helpers ───

function levelIndex(diff) {
  const i = LEVELS.indexOf((diff || 'medium').toLowerCase());
  return i >= 0 ? i : 1;
}

function clamp(i) {
  return Math.max(0, Math.min(LEVELS.length - 1, i));
}

// ─── Compute next difficulty from an answer sequence ───

function computeNextDifficulty(answers, startLevel = 'medium') {
  let idx = levelIndex(startLevel);
  let correctStreak = 0;
  let wrongStreak = 0;

  for (const a of answers) {
    const isCorrect =
      a.selectedAnswer !== null &&
      a.selectedAnswer !== undefined &&
      String(a.selectedAnswer) === String(a.correctAnswer);

    if (isCorrect) {
      correctStreak++;
      wrongStreak = 0;
      if (correctStreak >= STREAK_UP) {
        idx = clamp(idx + 1);
        correctStreak = 0;
      }
    } else {
      wrongStreak++;
      correctStreak = 0;
      if (wrongStreak >= STREAK_DOWN) {
        idx = clamp(idx - 1);
        wrongStreak = 0;
      }
    }
  }

  return {
    nextDifficultyLevel: LEVELS[idx],
    currentStreaks: { correctStreak, wrongStreak },
    levelIndex: idx
  };
}

// ─── Evaluate from full test history ───

function evaluateFromHistory() {
  const history = readHistory();

  if (history.length === 0) {
    return {
      nextDifficultyLevel: 'medium',
      message: 'No test history. Starting at medium.',
      currentStreaks: { correctStreak: 0, wrongStreak: 0 }
    };
  }

  // Flatten all answers in chronological order
  const allAnswers = history
    .sort((a, b) => new Date(a.submittedAt) - new Date(b.submittedAt))
    .flatMap(t => t.answers);

  const result = computeNextDifficulty(allAnswers);

  return {
    nextDifficultyLevel: result.nextDifficultyLevel,
    currentStreaks: result.currentStreaks,
    totalAnswers: allAnswers.length,
    testsAnalyzed: history.length
  };
}

// ─── Evaluate from a submitted answer sequence (stateless) ───

function evaluateFromAnswers(answers, startLevel) {
  if (!Array.isArray(answers) || answers.length === 0) {
    return {
      nextDifficultyLevel: startLevel || 'medium',
      currentStreaks: { correctStreak: 0, wrongStreak: 0 }
    };
  }
  return computeNextDifficulty(answers, startLevel);
}

module.exports = { evaluateFromHistory, evaluateFromAnswers, computeNextDifficulty };
