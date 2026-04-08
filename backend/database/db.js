import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const DB_DIR         = path.join(__dirname);
const QUESTIONS_PATH = path.join(DB_DIR, 'questions.json');
const HISTORY_PATH   = path.join(DB_DIR, 'testHistory.json');

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

function readQuestions() {
  return readJSON(QUESTIONS_PATH, []);
}

function writeQuestions(questions) {
  writeJSON(QUESTIONS_PATH, questions);
}

function nextQuestionId(questions) {
  return questions.length > 0 ? Math.max(...questions.map(q => q.id)) + 1 : 1;
}

function readHistory() {
  return readJSON(HISTORY_PATH, []);
}

function writeHistory(history) {
  writeJSON(HISTORY_PATH, history);
}

function nextHistoryId(history) {
  return history.length > 0 ? Math.max(...history.map(h => h.id)) + 1 : 1;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function ciMatch(value, target) {
  if (!value || !target) return false;
  return String(value).toLowerCase() === String(target).toLowerCase();
}

export {
  readQuestions,
  writeQuestions,
  nextQuestionId,
  readHistory,
  writeHistory,
  nextHistoryId,
  shuffle,
  ciMatch,
};