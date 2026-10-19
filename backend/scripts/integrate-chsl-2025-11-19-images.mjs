import dotenv from 'dotenv';
import dns from 'node:dns';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { MongoClient, BSON } from 'mongodb';
import sharp from 'sharp';
import pLimit from 'p-limit';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { examPaperSchema, paperPresentation } from '@meow/contracts/exam-paper';

dotenv.config({ path: new URL('../.env', import.meta.url), quiet: true });
dns.setServers((process.env.MONGODB_DNS_SERVERS || '1.1.1.1,8.8.8.8').split(','));
const apply = process.argv.includes('--apply');
const root = fileURLToPath(new URL('../../', import.meta.url));
const input = path.join(root, 'SSC_CHSL_2025-11-19_Shift_1_IMAGES (1)');
const output = process.env.CHSL_IMAGE_OUTPUT || path.join(homedir(), '.codex', 'artifacts', 'chsl-2025-11-19-shift-1-images');
const scope = { id: 'chsl-pyq-2025-19 nov', examSlug: 'ssc-chsl', examDate: '2025-11-19', shift: 1 };
const hash = buffer => createHash('sha256').update(buffer).digest('hex');
const letters = ['A', 'B', 'C', 'D'];
const client = new MongoClient(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000 });
const { b2Client, B2_BUCKET } = await import('../config/b2.js');

function imageOption(label, url, language) {
  return language === 'bn' ? `${label}\n![বিকল্প ${label} এর চিত্র](${url})` : `${label}\n![Option ${label} diagram](${url})`;
}

try {
  await client.connect();
  const db = client.db(process.env.MONGODB_DB || 'quizDB');
  const slots = db.collection('mockSlots');
  const slot = await slots.findOne(scope);
  assert(slot, 'The exact dated Shift 1 paper must exist');
  assert.equal(slot.sourcePaper.exam, 'SSC_CHSL');
  assert.equal(slot.sourcePaper.type, 'PYQ');
  assert.equal(slot.sourcePaper.examDate, scope.examDate);
  assert.equal(slot.sourcePaper.shift, scope.shift);
  const sourceQuestions = Object.entries(slot.sourcePaper.sections).flatMap(([section, value]) => value.questions.map((question, index) => ({ section, index, question })));
  const map = JSON.parse(await readFile(path.join(input, 'IMAGE_MAP.json'), 'utf8'));
  assert.equal(Object.keys(map).length, 9);
  const assets = [];
  await mkdir(path.join(output, 'webp'), { recursive: true });
  for (const [id, entry] of Object.entries(map)) {
    assert.equal(sourceQuestions.filter(row => row.question.id === id).length, 1, `Ambiguous question ID ${id}`);
    assert.equal(sourceQuestions.find(row => row.question.id === id).section, 'reasoning');
    for (const [role, filename] of [['question', entry.question], ...Object.entries(entry.options || {})]) {
      if (!filename) continue;
      assert.equal(path.basename(filename), filename);
      assert.equal(filename, `${id}_${role}.png`);
      const original = await readFile(path.join(input, filename));
      const { data, info } = await sharp(original).webp({ lossless: true, effort: 6 }).toBuffer({ resolveWithObject: true });
      const originalPixels = await sharp(original).ensureAlpha().raw().toBuffer();
      const webpPixels = await sharp(data).ensureAlpha().raw().toBuffer();
      assert.deepEqual(webpPixels, originalPixels, `Pixel mismatch in ${filename}`);
      const digest = hash(data);
      const key = `question-images/pyq/ssc-chsl/2025-11-19/shift-1/${id}/${role}-${digest.slice(0, 16)}.webp`;
      const asset = { id, role, filename, width: info.width, height: info.height, originalBytes: original.length,
        bytes: data.length, sha256: digest, key, url: `/api/upload/image/${Buffer.from(key).toString('base64url')}` };
      await writeFile(path.join(output, 'webp', filename.replace(/\.png$/, '.webp')), data);
      assets.push(asset);
    }
  }
  assert.equal(assets.length, 36);
  const getAsset = (id, role) => assets.find(asset => asset.id === id && asset.role === role);
  const sourceSet = {};
  const sourceFilter = { _id: slot._id, ...scope };
  for (const row of sourceQuestions.filter(row => map[row.question.id])) {
    const prefix = `sourcePaper.sections.${row.section}.questions.${row.index}`;
    sourceFilter[`${prefix}.id`] = row.question.id;
    const questionAsset = getAsset(row.question.id, 'question');
    if (questionAsset) {
      sourceSet[`${prefix}.questionImage`] = questionAsset.url;
      sourceSet[`${prefix}.questionImageWidth`] = questionAsset.width;
      sourceSet[`${prefix}.questionImageHeight`] = questionAsset.height;
    }
    if (Object.keys(map[row.question.id].options || {}).length) {
      assert.deepEqual(Object.keys(map[row.question.id].options), letters);
      for (const language of ['en', 'bn']) {
        const previous = row.question.options[language];
        assert(previous.every((text, index) => text === letters[index] || text === imageOption(letters[index], getAsset(row.question.id, letters[index]).url, language)), `Unexpected option text in ${row.question.id}`);
        sourceFilter[`${prefix}.options.${language}`] = previous;
        sourceSet[`${prefix}.options.${language}`] = letters.map(letter => imageOption(letter, getAsset(row.question.id, letter).url, language));
      }
    }
  }
  const patchedPaper = structuredClone(slot.sourcePaper);
  for (const section of Object.values(patchedPaper.sections)) for (const question of section.questions) {
    if (!map[question.id]) continue;
    const image = getAsset(question.id, 'question');
    if (image) Object.assign(question, { questionImage: image.url, questionImageWidth: image.width, questionImageHeight: image.height });
    if (map[question.id].options?.A) for (const language of ['en', 'bn']) question.options[language] = letters.map(letter => imageOption(letter, getAsset(question.id, letter).url, language));
  }
  const parsed = examPaperSchema.parse(patchedPaper);
  const presented = paperPresentation(parsed);
  assert.equal(presented.sections.reduce((sum, section) => sum + section.questions.length, 0), sourceQuestions.length);
  for (const row of sourceQuestions) {
    const question = parsed.sections[row.section].questions[row.index];
    assert.equal(question.answer, row.question.answer);
    assert.deepEqual(question.solution, row.question.solution);
    assert.deepEqual(question.question, row.question.question);
  }
  for (const asset of assets) assert(JSON.stringify(presented).includes(asset.url), `Image lost during paper presentation: ${asset.filename}`);
  const attemptsCollection = db.collection('mockAttempts');
  const attempts = await attemptsCollection.find({ examSlug: scope.examSlug, testId: scope.id }).toArray();
  const attemptUpdates = [];
  for (const attempt of attempts) {
    const set = {};
    const filter = { _id: attempt._id, examSlug: scope.examSlug, testId: scope.id };
    for (const [sectionIndex, section] of (attempt.paper?.sections || []).entries()) for (const [questionIndex, question] of (section.questions || []).entries()) {
      if (!map[question.id]) continue;
      const prefix = `paper.sections.${sectionIndex}.questions.${questionIndex}`;
      filter[`${prefix}.id`] = question.id;
      const image = getAsset(question.id, 'question');
      if (image) Object.assign(set, { [`${prefix}.questionImage`]: image.url, [`${prefix}.questionImageWidth`]: image.width, [`${prefix}.questionImageHeight`]: image.height });
      if (map[question.id].options?.A) {
        assert.equal(question.options.length, 4);
        if (question.options.every(option => typeof option === 'object')) {
          for (const [index, option] of question.options.entries()) {
            assert.equal(String(option.id), attempt.paper.schemaDriven ? letters[index] : String(index));
            set[`${prefix}.options.${index}.image`] = getAsset(question.id, letters[index]).url;
          }
        } else set[`${prefix}.optionImages`] = letters.map(letter => getAsset(question.id, letter).url);
      }
    }
    if (Object.keys(set).length) attemptUpdates.push({ updateOne: { filter, update: { $set: set } } });
  }
  const report = { mode: apply ? 'apply' : 'dry-run', slotId: scope.id, affectedQuestions: Object.keys(map), images: assets.length,
    questionImages: assets.filter(asset => asset.role === 'question').length, optionImages: assets.filter(asset => asset.role !== 'question').length,
    originalBytes: assets.reduce((sum, asset) => sum + asset.originalBytes, 0), webpBytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    existingAttempts: attempts.length, affectedAttempts: attemptUpdates.length, assets };
  await writeFile(path.join(output, apply ? 'apply-plan.json' : 'dry-run.json'), JSON.stringify(report, null, 2));
  if (apply) {
    const backupPath = path.join(output, `backup-${Date.now()}.ejson`);
    await writeFile(backupPath, BSON.EJSON.stringify({ slot, attempts }, null, 2));
    const limit = pLimit(4);
    await Promise.all(assets.map(asset => limit(async () => {
      const body = await readFile(path.join(output, 'webp', asset.filename.replace(/\.png$/, '.webp')));
      await b2Client.send(new PutObjectCommand({ Bucket: B2_BUCKET, Key: asset.key, Body: body, ContentType: 'image/webp', ContentLength: body.length,
        CacheControl: 'public, max-age=31536000, immutable', Metadata: { sha256: asset.sha256 } }));
      const stored = await b2Client.send(new GetObjectCommand({ Bucket: B2_BUCKET, Key: asset.key }));
      assert.equal(stored.ContentType, 'image/webp');
      assert.equal(hash(await stored.Body.transformToByteArray()), asset.sha256, `B2 readback mismatch: ${asset.key}`);
    })));
    const result = await slots.updateOne(sourceFilter, { $set: { ...sourceSet, updatedAt: new Date().toISOString() } });
    assert.equal(result.matchedCount, 1, 'Paper changed during upload; no attempt records were modified');
    const updated = attemptUpdates.length ? await attemptsCollection.bulkWrite(attemptUpdates, { ordered: true }) : { matchedCount: 0, modifiedCount: 0 };
    assert.equal(updated.matchedCount, attemptUpdates.length);
    const saved = await slots.findOne(scope);
    assert.deepEqual(examPaperSchema.parse(saved.sourcePaper), parsed);
    report.verifiedB2Objects = assets.length;
    report.updatedPaperCount = result.modifiedCount;
    report.updatedAttemptCount = updated.modifiedCount;
    report.backupPath = backupPath;
    await writeFile(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
  }
  const { assets: _assets, ...summary } = report;
  console.log(JSON.stringify({ ...summary, output }, null, 2));
} finally {
  await client.close();
  b2Client.destroy();
}
