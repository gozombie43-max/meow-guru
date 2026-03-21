const fs = require("fs");
const cheerio = require("cheerio");

const htmlPath = "data/raw/algebra.html";
const outPath = "data/algebra_questions.json";

let html;
try {
  html = fs.readFileSync(htmlPath, "utf8");
} catch (err) {
  console.error("Cannot read file:", htmlPath, err.message);
  process.exit(1);
}

// Strip leading numbering like "1.", "Q1.", "Q1)", "Q 1:", "1)" etc.
function trimNumbering(text) {
  return text.replace(/^\s*(?:Q|Que|Ques|Question)?\s*\d+\s*[.):\-]\s*/i, "").trim();
}

// Normalize whitespace for dedup comparison
function normalizeForDedup(text) {
  return text
    .replace(/[\s\u00A0]+/g, " ")
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .trim()
    .toLowerCase();
}

let questions = [];

// --- Strategy 1: Embedded JS array (const QUESTIONS = [...]) ---
const jsArrayMatch = html.match(
  /(?:const|let|var)\s+QUESTIONS\s*=\s*\[([\s\S]*?)\];\s*(?:\n|\/\/)/
);

if (jsArrayMatch) {
  console.log("Detected: embedded JS QUESTIONS array");
  const rawArray = jsArrayMatch[1];

  // Match each {...} object — use balanced-brace counting for safety
  const objects = [];
  let depth = 0, start = -1;
  for (let i = 0; i < rawArray.length; i++) {
    if (rawArray[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (rawArray[i] === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        objects.push(rawArray.slice(start, i + 1));
        start = -1;
      }
    }
  }

  for (const raw of objects) {
    const qMatch =
      raw.match(/q\s*:\s*'((?:[^'\\]|\\.)*)'/) ||
      raw.match(/q\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (!qMatch) continue;

    let questionText = qMatch[1].replace(/\\'/g, "'").replace(/\\"/g, '"');
    questionText = trimNumbering(questionText);
    if (!questionText) continue;

    const yearMatch =
      raw.match(/year\s*:\s*'([^']*)'/) || raw.match(/year\s*:\s*"([^"]*)"/);
    const examMatch =
      raw.match(/exam\s*:\s*'([^']*)'/) || raw.match(/exam\s*:\s*"([^"]*)"/);

    const optsMatch = raw.match(/opts\s*:\s*\[([^\]]*)\]/);
    let options = [];
    if (optsMatch) {
      options = (
        optsMatch[1].match(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g) || []
      ).map((o) => o.slice(1, -1));
    }

    const ansMatch = raw.match(/ans\s*:\s*(\d+)/);
    const answerIndex = ansMatch ? parseInt(ansMatch[1]) : null;

    questions.push({
      question: questionText,
      options,
      answer:
        answerIndex !== null && options[answerIndex]
          ? options[answerIndex]
          : null,
      year: yearMatch ? yearMatch[1] : "",
      exam: examMatch ? examMatch[1] : "",
      subject: "Quantitative Aptitude",
      chapter: "Algebra",
    });
  }
} else {
  // --- Strategy 2: HTML DOM — auto-detect repeating question containers ---
  console.log("No JS array found, falling back to HTML DOM extraction");
  let $;
  try {
    $ = cheerio.load(html);
  } catch (err) {
    console.error("Failed to parse HTML:", err.message);
    process.exit(1);
  }

  // Try common question container selectors in priority order
  const candidateSelectors = [
    ".q-card .q-text",
    ".question-text",
    ".question",
    ".q-text",
    '[class*="question"]',
    '[class*="q-text"]',
    ".card p",
    "li",
    "p",
  ];

  let bestSelector = null;
  let bestCount = 0;

  for (const sel of candidateSelectors) {
    const count = $(sel).length;
    if (count > bestCount) {
      bestCount = count;
      bestSelector = sel;
    }
  }

  if (!bestSelector || bestCount === 0) {
    console.error("Could not detect any question containers in HTML.");
    process.exit(1);
  }

  console.log(`Auto-detected selector: "${bestSelector}" (${bestCount} elements)`);

  $(bestSelector).each((_, el) => {
    let text = $(el).text().trim();
    text = trimNumbering(text);
    if (text.length < 15) return; // skip short/nav fragments

    questions.push({
      question: text,
      options: [],
      answer: null,
      year: "",
      exam: "",
      subject: "Quantitative Aptitude",
      chapter: "Algebra",
    });
  });
}

// --- Deduplication: keep first occurrence based on normalized text ---
const beforeDedup = questions.length;
const seen = new Set();
questions = questions.filter((q) => {
  const key = normalizeForDedup(q.question);
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
const dupsRemoved = beforeDedup - questions.length;

// save as json
fs.writeFileSync(outPath, JSON.stringify(questions, null, 2));

console.log("Converted:", questions.length, "questions");
if (dupsRemoved > 0) {
  console.log("Duplicates removed:", dupsRemoved);
}