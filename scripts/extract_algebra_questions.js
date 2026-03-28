#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rawHtmlPath = path.resolve(process.cwd(), 'data', 'raw', 'algebra.html');
if (!fs.existsSync(rawHtmlPath)) {
  console.error('raw html not found:', rawHtmlPath);
  process.exit(1);
}

const html = fs.readFileSync(rawHtmlPath, 'utf8');
const marker = 'const QUESTIONS =';
const idx = html.indexOf(marker);
if (idx === -1) {
  console.error('QUESTIONS marker not found in raw HTML');
  process.exit(1);
}

const bracketPos = html.indexOf('[', idx);
if (bracketPos === -1) {
  console.error('opening [ not found after QUESTIONS');
  process.exit(1);
}

let depth = 0;
let endPos = -1;
for (let i = bracketPos; i < html.length; i++) {
  const ch = html[i];
  if (ch === '[') depth++;
  else if (ch === ']') {
    depth--;
    if (depth === 0) {
      endPos = i;
      break;
    }
  }
}

if (endPos === -1) {
  console.error('closing ] not found for QUESTIONS array');
  process.exit(1);
}

const arrayText = html.slice(bracketPos, endPos + 1);

let data;
try {
  // Evaluate the array text in a fresh context — it contains plain JS literals.
  data = vm.runInNewContext('(' + arrayText + ')');
} catch (err) {
  console.error('Failed to parse QUESTIONS array:', err);
  process.exit(1);
}

if (!Array.isArray(data)) {
  console.error('Parsed value is not an array');
  process.exit(1);
}

const rawData = data.map((item) => {
  const id = item.gid !== undefined ? item.gid : item.id;
  const question = item.q !== undefined ? item.q : item.question || '';
  const options = item.opts || item.options || [];
  const ans = typeof item.ans === 'number' ? item.ans : typeof item.correct_option_index === 'number' ? item.correct_option_index : (typeof item.ans === 'string' ? parseInt(item.ans, 10) : 0);
  const correct_answer = options[ans] !== undefined ? options[ans] : item.correct_answer || '';
  return {
    id: Number(id),
    year: String(item.year || ''),
    exam: item.exam || '',
    date: item.date || '',
    question: String(question),
    options: options.map((o) => String(o)),
    correct_option_index: Number.isFinite(ans) ? ans : 0,
    correct_answer: String(correct_answer),
  };
});

const outPath = path.resolve(process.cwd(), 'frontend', 'data', 'algebra_questions.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(rawData, null, 2), 'utf8');
console.log('Wrote', outPath, 'with', rawData.length, 'questions');
