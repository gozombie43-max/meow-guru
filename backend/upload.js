// backend/upload.js
// Run with: node upload.js
// Make sure .env is in the same folder

import 'dotenv/config';
import { readFileSync } from 'fs';
import {
  connectMongoDB,
  getQuestionsCollection,
} from './config/mongodb.js';
import { createQuestion } from './schema.js';

// ── CONFIG ─────────────────────────────────────────────
const HTML_FILE   = './data/SSC_CGL_Tier_2_Algebra_PYQ_All_378_Questions_.html';
const TOPIC       = 'Algebra';
const CATEGORY    = 'Maths';
const EXAM        = 'SSC CGL';
const TIER        = 'Tier-II';
// ───────────────────────────────────────────────────────

// 1. Extract raw questions from HTML
function extractQuestions(html) {
  // Grab everything between `const QUESTIONS = [` and the closing `];`
  const match = html.match(/const QUESTIONS\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('QUESTIONS array not found in HTML');

  // Convert JS object literal to valid JSON
  const raw = match[1]
    .replace(/\bgid\b/g,    '"gid"')
    .replace(/\byear\b/g,   '"year"')
    .replace(/\bq\b:/g,     '"q":')
    .replace(/\bopts\b/g,   '"opts"')
    .replace(/\bans\b/g,    '"ans"')
    .replace(/\bexam\b/g,   '"exam"')
    .replace(/\bdate\b/g,   '"date"')
    .replace(/'/g, '"');    // single → double quotes

  return JSON.parse(raw);
}

// 2. Map raw → our schema
function mapQuestions(rawList) {
  return rawList.map(r =>
    createQuestion({
      gid:        r.gid,
      question:   r.q,
      options:    r.opts,
      answer:     r.ans,
      solution:   '',           // fill in later
      year:       r.year,
      exam:       EXAM,
      tier:       TIER,
      topic:      TOPIC,
      category:   CATEGORY,
      difficulty: 'medium',     // update later per question
      tags:       [TOPIC.toLowerCase(), 'previous-year', 'ssc-cgl', 'tier-2'],
    })
  );
}

// 3. Upload to MongoDB Atlas

async function upload(questions) {
  await connectMongoDB();

  const collection =
    getQuestionsCollection();

  let success = 0;
  let failed = 0;

  for (const q of questions) {
    try {
      /*
       * Your Mongo questions collection uses
       * id + topic as the safe logical identity.
       *
       * Fall back to gid if this older schema
       * does not contain id.
       */
      let filter;

      if (q.id) {
        filter = {
          id: q.id,
          topic: q.topic,
        };
      } else if (q.gid) {
        filter = {
          gid: q.gid,
          topic: q.topic,
        };
      } else {
        throw new Error(
          "Question has neither id nor gid"
        );
      }

      await collection.updateOne(
        filter,
        {
          $set: q,
        },
        {
          upsert: true,
        }
      );

      success++;

      if (
        success % 50 === 0
      ) {
        console.log(
          `  ✅ Uploaded ${success}/${questions.length}`
        );
      }

    } catch (err) {
      failed++;

      console.error(
        `  ❌ Failed gid=${q.gid ?? q.id}: ${err.message}`
      );
    }
  }

  console.log(
    `\nDone. ✅ ${success} uploaded, ❌ ${failed} failed.`
  );
}

// ── MAIN ───────────────────────────────────────────────
(async () => {
  try {
    console.log('Reading HTML...');
    const html = readFileSync(HTML_FILE, 'utf-8');

    console.log('Extracting questions...');
    const raw = extractQuestions(html);
    console.log(`  Found ${raw.length} questions`);

    const questions = mapQuestions(raw);
    console.log(`  Mapped to schema ✅`);

    console.log('Uploading to MongoDB Atlas...');
    await upload(questions);

  } catch (err) {
    console.error('Upload failed:', err.message);
    process.exit(1);
  }
})();
