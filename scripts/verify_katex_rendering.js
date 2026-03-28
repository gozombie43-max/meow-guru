const fs = require('fs');
const path = require('path');

let katex;
try {
  katex = require('katex');
} catch (err) {
  console.error('katex not found. Please run `npm install katex` in the frontend folder.');
  process.exit(2);
}

const dataPath = path.resolve(__dirname, '../frontend/data/algebra_questions.json');
if (!fs.existsSync(dataPath)) {
  console.error('Data file not found:', dataPath);
  process.exit(2);
}

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

function cleanToken(tok) {
  if (!tok) return tok;
  let s = tok;
  s = s.replace(/^[,;:\.\?\!\(\)\[\]"]+|[,;:\.\?\!\(\)\[\]"]+$/g, '');
  s = s.replace(/sqrt\s*\(\s*([^)]+)\s*\)/gi, '\\sqrt{$1}');
  s = s.replace(/√\s*([A-Za-z0-9]+)/g, '\\sqrt{$1}');
  s = s.replace(/([A-Za-z0-9\)\}])\^([A-Za-z0-9]+)/g, '$1^{$2}');
  s = s.replace(/^([0-9]+)\/([0-9]+)$/, '\\tfrac{$1}{$2}');
  s = s.replace(/\$/g, '');
  return s;
}

function tryRender(expr) {
  if (!expr || expr.length > 400) return false;
  try {
    const html = katex.renderToString(expr, { throwOnError: false, displayMode: false, trust: false });
    return typeof html === 'string' && html.indexOf('katex') !== -1;
  } catch (e) {
    return false;
  }
}

const report = [];
let totalCandidates = 0;
let totalRendered = 0;

for (let i = 0; i < Math.min(30, data.length); i++) {
  const q = data[i];
  const text = q.question || '';
  const tokens = text.split(/\s+/);
  const candidates = new Set();

  for (let t of tokens) {
    t = t.replace(/^[^\w\\]+|[^\w]+$/g, '');
    if (!t) continue;
    if (/\\|\^|√|sqrt|frac|\d+\/\d+/.test(t)) {
      candidates.add(cleanToken(t));
    }
  }

  for (let w = 2; w <= 5; w++) {
    for (let start = 0; start + w <= tokens.length; start++) {
      const slice = tokens.slice(start, start + w).join(' ');
      if (/\\|\^|√|sqrt|frac|\d+\/\d+/.test(slice)) {
        candidates.add(cleanToken(slice));
      }
    }
  }

  const candidateArray = Array.from(candidates).filter(Boolean);
  totalCandidates += candidateArray.length;
  let renderedCount = 0;

  for (const c of candidateArray) {
    if (!c) continue;
    if (tryRender(c)) {
      renderedCount++;
      totalRendered++;
    }
  }

  report.push({ id: q.id, questionSnippet: text.slice(0, 120), candidates: candidateArray.length, rendered: renderedCount });
}

console.log('KaTeX verification summary (first 30 questions):');
for (const r of report) {
  console.log(`Q#${r.id}: candidates=${r.candidates}, rendered=${r.rendered} — ${r.questionSnippet}`);
}
console.log(`Total candidates: ${totalCandidates}, total rendered: ${totalRendered}`);
if (totalRendered > 0) {
  console.log('Some math fragments rendered successfully with KaTeX.');
  process.exit(0);
} else {
  console.error('No fragments rendered successfully; check sanitisation heuristics or katex availability.');
  process.exit(1);
}
