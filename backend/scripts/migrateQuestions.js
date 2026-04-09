// backend/scripts/migrateQuestions.js
import 'dotenv/config';
import { initDB } from '../cosmos.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Load all JSON files ────────────────────────────────
function loadJSON(filename) {
  const filePath = path.join(__dirname, '..', 'data', filename);
  const raw = JSON.parse(readFileSync(filePath, 'utf-8'));

  // handle nested array [ [...], [...] ]  flatten to one array
  if (Array.isArray(raw) && Array.isArray(raw[0])) {
    return raw.flat();
  }

  // handle plain array
  if (Array.isArray(raw)) return raw;

  // handle { questions: [] } or { data: [] }
  if (Array.isArray(raw.questions)) return raw.questions;
  if (Array.isArray(raw.data))      return raw.data;

  return [];
}

// ── Convert letter answer to actual option text ────────
function resolveCorrectAnswer(options, correct) {
  const map = { a: 0, b: 1, c: 2, d: 3 };
  const index = map[correct?.toLowerCase()];
  if (index === undefined || index >= options.length) return options[0];
  return options[index];
}

// ── Transform one question to Cosmos format ────────────
function transform(q, topic, chapter, subject = 'mathematics') {
  return {
    id:            `${topic}_${q.id}`,   // e.g. "trigonometry_288"
    topic,                                // ← partition key
    subject,
    chapter,
    concept:       q.concept     || '',
    difficulty:    q.difficulty  || 'medium',
    exam:          q.exam        || '',
    question:      q.text,               // ← renamed from "text"
    options:       q.options,
    correctAnswer: resolveCorrectAnswer(q.options, q.correct),
    correctLetter: q.correct,            // keep original "b" etc.
    solution:      q.solution    || '',
    createdAt:     new Date().toISOString(),
  };
}

// ── All files with their topic/chapter mapping ─────────
const files = [
  { file: 'trigonometry_questions.json',  topic: 'trigonometry',  chapter: 'Trigonometry'  },
  { file: 'algebra_questions.json',       topic: 'algebra',       chapter: 'Algebra'       },
  { file: 'geometry_questions.json',      topic: 'geometry',      chapter: 'Geometry'      },
  { file: 'mensuration_questions.json',   topic: 'mensuration',   chapter: 'Mensuration'   },
  { file: 'percentages_questions.json',   topic: 'percentages',   chapter: 'Percentages'   },
];

// ── Run migration ──────────────────────────────────────
async function migrate() {
  console.log('Connecting to Cosmos DB...');
  const container = await initDB();
  console.log('Connected ✅\n');

  let totalSuccess = 0;
  let totalFailed  = 0;

  for (const { file, topic, chapter } of files) {
    console.log(`\nMigrating ${file}...`);

    let questions;
    try {
      questions = loadJSON(file);
      // handle both array and { questions: [...] } format
      if (!Array.isArray(questions)) questions = questions.questions || [];
    } catch (err) {
      console.error(`  Could not load ${file}: ${err.message}`);
      continue;
    }

    let success = 0, failed = 0;

    for (const q of questions) {
      try {
        const doc = transform(q, topic, chapter);
        await container.items.upsert(doc);  // upsert = safe to re-run
        success++;
      } catch (err) {
        console.error(`  Failed id=${q.id}: ${err.message}`);
        failed++;
      }
    }

    console.log(`  ✅ ${success} inserted, ❌ ${failed} failed`);
    totalSuccess += success;
    totalFailed  += failed;
  }

  console.log(`\n════════════════════════════════`);
  console.log(`Total inserted: ${totalSuccess}`);
  console.log(`Total failed:   ${totalFailed}`);
  console.log(`════════════════════════════════`);
}

migrate();