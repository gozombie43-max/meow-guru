// backend/scripts/bulkGenerate.js
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { chatJSON } from '../ai/azureClient.js';

// ── Config — change these as needed ──────────────────
const TOPIC = "Percentage";
const SUBJECT = "Maths";
const DIFFICULTY = "medium";
const TOTAL_QUESTIONS = 100;
const BATCH_SIZE = 5;
const OUTPUT_FILE = `./data/${TOPIC.replace(/\s+/g, '_')}_questions.ndjson`;
// ─────────────────────────────────────────────────────

const systemPrompt = `You are an expert SSC CGL and CAT exam question creator.
Always respond with valid JSON array only. No markdown, no explanation, no code fences.`;

async function generateBatch(batchNum) {
  const userPrompt = `Generate ${BATCH_SIZE} unique MCQ questions on topic: "${TOPIC}", 
subject: "${SUBJECT}", difficulty: "${DIFFICULTY}" for SSC CGL / CAT exam.

Rules:
- Questions must be unique, no repetition
- Use proper mathematical notation
- Each question must have exactly 4 options
- correctAnswer is 0-indexed (0=A, 1=B, 2=C, 3=D)

Return a JSON array:
[
  {
    "question": "question text",
    "options": ["A) opt1", "B) opt2", "C) opt3", "D) opt4"],
    "correctAnswer": 0,
    "explanation": "step by step solution",
    "topic": "${TOPIC}",
    "subject": "${SUBJECT}",
    "difficulty": "${DIFFICULTY}"
  }
]`;

  console.log(`Generating batch ${batchNum}/${TOTAL_QUESTIONS / BATCH_SIZE}...`);
  const questions = await chatJSON(userPrompt, "o4-mini", systemPrompt);
  return questions;
}

async function main() {
  // Create data folder if not exists
  if (!fs.existsSync('./data')) fs.mkdirSync('./data');

  const writeStream = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' });
  let total = 0;
  const batches = TOTAL_QUESTIONS / BATCH_SIZE;

  for (let i = 1; i <= batches; i++) {
    try {
      const questions = await generateBatch(i);

      for (const q of questions) {
        // Add metadata
        q.id = `${TOPIC.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        q.createdAt = new Date().toISOString();
        q.source = "ai-generated";

        writeStream.write(JSON.stringify(q) + '\n');
        total++;
      }

      console.log(`✅ Batch ${i} done — ${total} questions so far`);

      // Wait 1 second between batches to avoid rate limits
      if (i < batches) await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      console.error(`❌ Batch ${i} failed:`, err.message);
      // Wait and continue with next batch
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  writeStream.end();
  console.log(`\n🎉 Done! ${total} questions saved to ${OUTPUT_FILE}`);
}

main();