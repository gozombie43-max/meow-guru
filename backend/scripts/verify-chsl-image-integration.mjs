import dotenv from 'dotenv';
import dns from 'node:dns';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { MongoClient, BSON } from 'mongodb';
import pLimit from 'p-limit';
import { examPaperSchema, paperPresentation } from '@meow/contracts/exam-paper';
dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
dns.setServers((process.env.MONGODB_DNS_SERVERS || '1.1.1.1,8.8.8.8').split(','));
const folder = process.env.CHSL_IMAGE_OUTPUT || path.join(homedir(), '.codex', 'artifacts', 'chsl-2025-11-19-shift-1-images');
const manifest = JSON.parse(await readFile(path.join(folder, 'result.json'), 'utf8'));
const backup = BSON.EJSON.parse(await readFile(manifest.backupPath, 'utf8'));
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'quizDB');
  const slot = await db.collection('mockSlots').findOne({ id: manifest.slotId, examSlug: 'ssc-chsl', examDate: '2025-11-19', shift: 1 });
  assert(slot);
  const source = examPaperSchema.parse(slot.sourcePaper);
  const paper = paperPresentation(source);
  const before = backup.slot.sourcePaper;
  let changedQuestions = 0;
  for (const [key, section] of Object.entries(source.sections)) for (const [index, question] of section.questions.entries()) {
    const old = before.sections[key].questions[index];
    assert.equal(question.id, old.id);
    assert.equal(question.answer, old.answer);
    assert.deepEqual(question.solution, old.solution);
    assert.deepEqual(question.question, old.question);
    if (!manifest.affectedQuestions.includes(question.id)) assert.deepEqual(question, old);
    else changedQuestions++;
  }
  assert.equal(changedQuestions, 9);
  assert.equal(paper.sections.reduce((sum, section) => sum + section.questionCount, 0), 100);
  const attempts = await db.collection('mockAttempts').find({ examSlug: 'ssc-chsl', testId: manifest.slotId }).toArray();
  let verifiedAttempts = 0;
  for (const attempt of attempts) {
    const old = backup.attempts.find(item => String(item._id) === String(attempt._id));
    if (!old) continue;
    for (const [sectionIndex, section] of attempt.paper.sections.entries()) for (const [questionIndex, question] of section.questions.entries()) {
      const previous = old.paper.sections[sectionIndex].questions[questionIndex];
      assert.equal(question.id, previous.id);
      if (!manifest.affectedQuestions.includes(question.id)) { assert.deepEqual(question, previous); continue; }
      const image = manifest.assets.find(asset => asset.id === question.id && asset.role === 'question');
      if (image) assert.equal(question.questionImage, image.url);
      for (const [index, letter] of ['A', 'B', 'C', 'D'].entries()) {
        const asset = manifest.assets.find(asset => asset.id === question.id && asset.role === letter);
        if (asset) assert.equal(question.options[index].image || question.optionImages?.[index], asset.url);
      }
    }
    assert.deepEqual(attempt.answers, old.answers);
    assert.deepEqual(attempt.answerKey, old.answerKey);
    assert.deepEqual(attempt.result, old.result);
    assert.equal(attempt.status, old.status);
    verifiedAttempts++;
  }
  assert.equal(verifiedAttempts, manifest.affectedAttempts);
  const limit = pLimit(4);
  const http = await Promise.all(manifest.assets.map(asset => limit(async () => {
    const response = await fetch(`${process.env.BACKEND_PUBLIC_URL.replace(/\/$/, '')}${asset.url}`, { signal: AbortSignal.timeout(30000) });
    assert.equal(response.status, 200, asset.filename);
    assert.match(response.headers.get('content-type'), /^image\/webp/);
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(body).digest('hex'), asset.sha256);
    return { file: asset.filename, status: response.status, bytes: body.length, verified: true };
  })));
  await writeFile(path.join(folder, 'paper-after.json'), JSON.stringify({ slot: { id: slot.id, examSlug: slot.examSlug, title: slot.title, configKey: slot.configKey, order: slot.order, isFree: true, isPyq: true, paperMetadata: slot.paperMetadata }, source, paper }, null, 2));
  await writeFile(path.join(folder, 'http-verification.json'), JSON.stringify({ verifiedImages: http.length, verifiedQuestions: changedQuestions, verifiedAttempts, images: http }, null, 2));
  console.log(JSON.stringify({ verifiedImages: http.length, verifiedQuestions: changedQuestions, verifiedAttempts, totalQuestions: 100, sourceAnswersPreserved: true, attemptAnswersAndResultsPreserved: true }, null, 2));
} finally { await client.close(); }
