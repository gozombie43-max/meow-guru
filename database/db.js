/**
 * Central data access layer for the SSC platform.
 * All file I/O for questions and test history goes through here.
 */

const fs = require('fs');
const path = require('path');

const DB_DIR       = path.join(__dirname);
const QUESTIONS_PATH = path.join(DB_DIR, 'questions.json');
const HISTORY_PATH   = path.join(DB_DIR, 'testHistory.json');

// ─── Safe file helpers ───

function readJSON(filePath, fallback = []) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2), 'utf-8');
      return fallback;
    }
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`[db] Error reading ${filePath}:`, err.message);
    return fallback;
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error(`[db] Error writing ${filePath}:`, err.message);
    throw err;
  }
}

// ─── Questions ───

function readQuestions() {
  return readJSON(QUESTIONS_PATH, []);
}

function writeQuestions(questions) {
  writeJSON(QUESTIONS_PATH, questions);
}

function nextQuestionId(questions) {
  return questions.length > 0 ? Math.max(...questions.map(q => q.id)) + 1 : 1;
}

// ─── Test History ───

function readHistory() {
  return readJSON(HISTORY_PATH, []);
}

function writeHistory(history) {
  writeJSON(HISTORY_PATH, history);
}

function nextHistoryId(history) {
  return history.length > 0 ? Math.max(...history.map(h => h.id)) + 1 : 1;
}

// ─── Utility: shuffle array (Fisher-Yates) ───

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Utility: case-insensitive match ───

function ciMatch(value, target) {
  if (!value || !target) return false;
  return String(value).toLowerCase() === String(target).toLowerCase();
}

module.exports = {
  readQuestions,
  writeQuestions,
  nextQuestionId,
  readHistory,
  writeHistory,
  nextHistoryId,
  shuffle,
  ciMatch
};
