import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import JSZip from 'jszip';
import sharp from 'sharp';
const { putObject, deleteObject } = vi.hoisted(() => ({ putObject: vi.fn(), deleteObject: vi.fn() }));
vi.mock('../../infrastructure/objectStorage.js', () => ({ putObject, deleteObject, stableImageUrl: key => `/api/upload/image/${Buffer.from(key).toString('base64url')}` }));
vi.mock('../../middleware/auth.js', () => ({ default: (req, res, next) => req.headers['x-test-admin'] === '1' ? next() : res.sendStatus(403) }));
import mockRoutes from '../../routes/mocktest.js';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { buildPaper } from '../mock/mockPaperService.js';
import { JAM_MOCK_CONFIGS } from '@meow/contracts/jam';

let mongo, db, server, base;
const stamp = '2026-10-18T00:00:00.000Z';
const questions = Array.from({ length: 100 }, (_, i) => ({ id: `q${i + 1}`, question: `Question ${i + 1}`,
  questionType: 'MCQ', options: ['One', 'Two', 'Three', 'Four'], correctAnswer: 'A', solution: 'Explanation',
  sectionKey: ['reasoning', 'gk', 'math', 'english'][Math.floor(i / 25)], questionUid: `uid-${i}`, topic: 'algebra' }));
const legacy = { id: 'paper100', examSlug: 'ssc-cgl', configKey: 'ssc-cgl-tier1', title: '100-question paper', fixedQuestions: questions,
  isFree: true, order: 3, questionCount: 100, assessmentMode: 'practice', updatedAt: stamp };
const bilingual = { ...legacy, id: 'bilingual', fixedQuestions: undefined, sourcePaper: {
  exam: 'SSC_CGL', tier: 1, type: 'MOCK', marksPerQuestion: 2, negativeMarks: .5,
  sections: { math: { duration: 15, questions: [{ id: 'b1', question: { en: 'English question', bn: 'বাংলা প্রশ্ন' },
    options: { en: ['One', 'Two', 'Three', 'Four'], bn: ['এক', 'দুই', 'তিন', 'চার'] }, answer: 'A', solution: { en: 'Solution', bn: 'সমাধান' } }] } },
}, paperMetadata: { preserved: true } };
const call = (path, method = 'GET', body, admin = true) => fetch(`${base}/api/mocktest${path}`, {
  method, headers: { 'Content-Type': 'application/json', ...(admin ? { 'x-test-admin': '1' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
});
const endpoint = id => `/admin/slots/${id}/questions?examSlug=ssc-cgl&examMode=ssc`;
const load = async id => { const response = await call(endpoint(id)); expect(response.status).toBe(200); return response.json(); };
const zipStatus = async id => {
  const response = await call('/admin/all-slots?exam=all&examMode=ssc');
  expect(response.status).toBe(200);
  const { slots } = await response.json();
  const slot = slots.find(slot => slot.id === id);
  expect(slot).not.toHaveProperty('fixedQuestions');
  expect(slot).not.toHaveProperty('sourcePaper');
  return slot.hasZipImages;
};
const payload = q => { const { sectionKey: _section, questionType: _type, ...edit } = q; return edit; };

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  vi.stubEnv('MONGODB_URI', mongo.getUri()); vi.stubEnv('MONGODB_DB', 'paper_editor');
  db = await connectMongoDB();
  const app = express(); app.use(express.json()); app.use('/api/mocktest', mockRoutes);
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
}, 120000);
beforeEach(async () => { putObject.mockReset().mockResolvedValue(undefined); deleteObject.mockReset().mockResolvedValue(undefined); await db.collection('mockSlots').deleteMany({}); await db.collection('mockSlots').insertMany([structuredClone(legacy), structuredClone(bilingual)]); });
afterAll(async () => { await new Promise(resolve => server.close(resolve)); await disconnectMongoDB(); await mongo.stop(); vi.unstubAllEnvs(); });

it('loads all 100 questions and updates question 100, its options, answer and image in the actual engine source', async () => {
  const loaded = await load('paper100');
  expect(loaded.questions).toHaveLength(100);
  const edit = { ...payload(loaded.questions[99]), question: 'Edited last question', options: ['First', 'Second', 'Third', 'Fourth'], correctAnswer: 'B', questionImage: '/api/upload/image/test' };
  const response = await call(endpoint('paper100'), 'PATCH', { examSlug: 'ssc-cgl', expectedUpdatedAt: loaded.updatedAt, edits: [edit] });
  expect(response.status, await response.clone().text()).toBe(200);
  const stored = await db.collection('mockSlots').findOne({ id: 'paper100' });
  expect(stored.fixedQuestions.slice(0, 99)).toEqual(questions.slice(0, 99));
  expect(stored.fixedQuestions[99]).toMatchObject({ ...edit, questionUid: 'uid-99', sectionKey: 'english' });
  expect(stored).toMatchObject({ order: 3, isFree: true, questionCount: 100 });
  expect(await zipStatus('paper100')).toBe(false);
  const built = await buildPaper({ examSlug: 'ssc-cgl', testId: 'paper100' });
  expect(built.clientPaper.sections.flatMap(s => s.questions).find(q => q.legacyId === 'q100')).toMatchObject({ question: 'Edited last question', questionImage: edit.questionImage });
  expect(built.answerKey['uid-99']).toBe('B');
});

it('preserves bilingual structure and timers and exposes attached images to the quiz engine', async () => {
  const loaded = await load('bilingual');
  const edit = { ...payload(loaded.questions[0]), question: 'Updated English', questionImage: 'https://example.test/diagram.png',
    translations: { bn: { ...loaded.questions[0].translations.bn, question: 'নতুন প্রশ্ন' } } };
  expect((await call(endpoint('bilingual'), 'PATCH', { examSlug: 'ssc-cgl', expectedUpdatedAt: loaded.updatedAt, edits: [edit] })).status).toBe(200);
  const stored = await db.collection('mockSlots').findOne({ id: 'bilingual' });
  expect(stored.sourcePaper.sections.math.duration).toBe(15);
  expect(stored.paperMetadata).toEqual({ preserved: true });
  expect(stored.sourcePaper.sections.math.questions[0].options.bn).toEqual(bilingual.sourcePaper.sections.math.questions[0].options.bn);
  const built = await buildPaper({ examSlug: 'ssc-cgl', testId: 'bilingual' });
  expect(built.clientPaper.sections[0].questions[0]).toMatchObject({ question: 'Updated English', questionImage: edit.questionImage, translations: { question: { bn: 'নতুন প্রশ্ন' } } });
});

it('requires admin access and rejects cross-mode reads and writes', async () => {
  expect((await call(endpoint('paper100'), 'GET', undefined, false)).status).toBe(403);
  expect((await call(endpoint('paper100'), 'PATCH', {}, false)).status).toBe(403);
  expect((await call('/admin/slots/paper100/questions?examSlug=ssc-cgl&examMode=iit-jam')).status).toBe(400);
  expect((await call('/admin/slots/paper100/questions?examMode=iit-jam', 'PATCH', { examSlug: 'ssc-cgl' })).status).toBe(400);
});

it('rejects stale saves and invalid keys without changing the stored paper', async () => {
  const loaded = await load('paper100'); const edit = payload(loaded.questions[0]);
  const body = { examSlug: 'ssc-cgl', expectedUpdatedAt: loaded.updatedAt, edits: [{ ...edit, correctAnswer: 'Z' }] };
  expect((await call(endpoint('paper100'), 'PATCH', body)).status).toBe(422);
  expect((await db.collection('mockSlots').findOne({ id: 'paper100' })).updatedAt).toBe(stamp);
  body.edits = [{ ...edit, id: 'not-in-paper' }];
  expect((await call(endpoint('paper100'), 'PATCH', body)).status).toBe(422);
  body.edits = [{ ...edit, question: 'First save' }];
  expect((await call(endpoint('paper100'), 'PATCH', body)).status).toBe(200);
  expect((await call(endpoint('paper100'), 'PATCH', body)).status).toBe(409);
  expect((await db.collection('mockSlots').findOne({ id: 'paper100' })).fixedQuestions[0].question).toBe('First save');
});

it('removes images and their stale dimensions without affecting question identity', async () => {
  await db.collection('mockSlots').updateOne({ id: 'paper100' }, { $set: { 'fixedQuestions.0.questionImage': '/old.png', 'fixedQuestions.0.questionImageWidth': 100, 'fixedQuestions.0.questionImageHeight': 50 } });
  const loaded = await load('paper100');
  expect((await call(endpoint('paper100'), 'PATCH', { examSlug: 'ssc-cgl', expectedUpdatedAt: loaded.updatedAt, edits: [{ ...payload(loaded.questions[0]), questionImage: null }] })).status).toBe(200);
  const question = (await db.collection('mockSlots').findOne({ id: 'paper100' })).fixedQuestions[0];
  expect(question.questionUid).toBe('uid-0'); expect(question.questionImage).toBeNull(); expect(question.questionImageWidth).toBeUndefined();
});

it('edits JAM MSQ and numerical answers while preserving the required full paper', async () => {
  const fixedQuestions = JAM_MOCK_CONFIGS['iit-jam-physics'].sections.flatMap(section => Array.from({ length: section.questionCount }, (_, index) => ({
    id: `${section.key}-${index}`, sectionKey: section.key, questionType: section.questionType,
    question: 'Physics question', solution: 'Physics solution', options: section.questionType === 'NAT' ? [] : ['One', 'Two', 'Three', 'Four'],
    correctAnswer: section.questionType === 'NAT' ? 1 : section.questionType === 'MSQ' ? [0, 2] : 0,
  })));
  await db.collection('mockSlots').insertOne({ id: 'jam-editor', examSlug: 'iit-jam-physics', configKey: 'iit-jam-physics', fixedQuestions, updatedAt: stamp });
  const url = '/admin/slots/jam-editor/questions?examSlug=iit-jam-physics&examMode=iit-jam';
  const loaded = await (await call(url)).json();
  const msq = loaded.questions.find(q => q.questionType === 'MSQ');
  const nat = loaded.questions.find(q => q.questionType === 'NAT');
  const result = await call(url, 'PATCH', { examSlug: 'iit-jam-physics', expectedUpdatedAt: loaded.updatedAt,
    edits: [{ ...payload(msq), correctAnswer: [1, 3] }, { ...payload(nat), correctAnswer: { min: 1.5, max: 2.5 }, questionImage: '/jam-diagram.png' }] });
  expect(result.status, await result.clone().text()).toBe(200);
  const stored = await db.collection('mockSlots').findOne({ id: 'jam-editor' });
  expect(stored.fixedQuestions).toHaveLength(60);
  expect(stored.fixedQuestions.find(q => q.id === msq.id).correctAnswer).toEqual([1, 3]);
  expect(stored.fixedQuestions.find(q => q.id === nat.id).correctAnswer).toEqual({ min: 1.5, max: 2.5 });
  const zipOptions = { id: 'jam-editor', examSlug: 'iit-jam-physics' };
  const images = [{ ...imageMapping, questionId: nat.id }];
  const imported = await zipRequest(await imageZip({ ...zipOptions, images }), { ...zipOptions, mode: 'iit-jam', action: 'apply', version: stored.updatedAt });
  expect(imported.status, await imported.clone().text()).toBe(200);
  const jam = await db.collection('mockSlots').findOne({ id: 'jam-editor' });
  expect(jam.fixedQuestions.find(q => q.id === nat.id).questionImage).toContain('/api/upload/image/');
  const rejected = await zipRequest(await imageZip({ ...zipOptions, images: [{ ...images[0], target: 'option', option: 'A', language: 'en' }] }), { ...zipOptions, mode: 'iit-jam', version: jam.updatedAt });
  expect(rejected.status).toBe(422);
});

const imageMapping = { questionId: 'q1', target: 'question', file: 'images/question.png' };
async function imageZip({ id = 'paper100', examSlug = 'ssc-cgl', images = [imageMapping], files, manifest = true } = {}) {
  const zip = new JSZip();
  if (manifest) zip.file('manifest.json', JSON.stringify({ version: 1, examSlug, paperId: id, images }));
  const png = await sharp({ create: { width: 20, height: 10, channels: 3, background: '#007aff' } }).png().toBuffer();
  for (const [name, bytes] of Object.entries(files || { 'images/question.png': png })) zip.file(name, bytes);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
async function zipRequest(buffer, { id = 'paper100', examSlug = 'ssc-cgl', action = 'validate', version = stamp, mode = 'ssc', admin = true } = {}) {
  const body = new FormData(); body.append('zipFile', new Blob([buffer]), 'images.zip');
  body.append('action', action); body.append('expectedUpdatedAt', JSON.stringify(version));
  return fetch(`${base}/api/mocktest/admin/slots/${id}/question-images-zip?examSlug=${examSlug}&examMode=${mode}`, { method: 'POST', headers: admin ? { 'x-test-admin': '1' } : {}, body });
}

it('validates a ZIP without writes, then uploads once and links question/option images in the test engine', async () => {
  const bytes = await imageZip({ images: [imageMapping, { ...imageMapping, target: 'option', option: 'B', language: 'en' }] });
  const preview = await zipRequest(bytes);
  expect(preview.status, await preview.clone().text()).toBe(200);
  expect(await preview.json()).toMatchObject({ valid: true, questionCount: 1, fileCount: 1 });
  expect(putObject).not.toHaveBeenCalled();
  expect((await db.collection('mockSlots').findOne({ id: 'paper100' })).updatedAt).toBe(stamp);
  expect(await zipStatus('paper100')).toBe(false);
  const saved = await zipRequest(bytes, { action: 'apply' });
  expect(saved.status, await saved.clone().text()).toBe(200);
  expect(await saved.json()).toMatchObject({ savedQuestions: 1, fileCount: 1 });
  expect(putObject).toHaveBeenCalledTimes(1);
  expect(putObject.mock.calls[0][0]).toMatch(/^question-images\/paper-imports\//);
  expect(await sharp(putObject.mock.calls[0][1]).metadata()).toMatchObject({ format: 'webp', width: 20, height: 10 });
  const stored = await db.collection('mockSlots').findOne({ id: 'paper100' });
  expect(stored.fixedQuestions[0].questionImage).toContain('/api/upload/image/');
  expect(stored.fixedQuestions[0].options[1]).toBe(`![Option B](${stored.fixedQuestions[0].questionImage})`);
  expect(stored.fixedQuestions.slice(1)).toEqual(questions.slice(1));
  const built = await buildPaper({ examSlug: 'ssc-cgl', testId: 'paper100' });
  expect(built.clientPaper.sections.flatMap(section => section.questions).find(q => q.legacyId === 'q1').options[1]).toContain('![Option B]');
  expect(built.answerKey['uid-0']).toBe(0);
  expect((await zipRequest(bytes, { action: 'apply' })).status).toBe(409);
  expect(putObject).toHaveBeenCalledTimes(1);
  expect(await zipStatus('paper100')).toBe(true);
  const loaded = await load('paper100');
  const edit = { ...payload(loaded.questions[0]), questionImage: null };
  // An option image alone still counts after removing the question image.
  expect((await call(endpoint('paper100'), 'PATCH', { examSlug: 'ssc-cgl', expectedUpdatedAt: loaded.updatedAt, edits: [edit] })).status).toBe(200);
  expect(await zipStatus('paper100')).toBe(true);
  const current = await load('paper100');
  edit.options = ['One', 'Two', 'Three', 'Four'];
  expect((await call(endpoint('paper100'), 'PATCH', { examSlug: 'ssc-cgl', expectedUpdatedAt: current.updatedAt, edits: [edit] })).status).toBe(200);
  expect(await zipStatus('paper100')).toBe(false);
});

it('links bilingual option images only to the chosen language and preserves timers and answers', async () => {
  await db.collection('mockSlots').updateOne({ id: 'bilingual' }, { $set: { 'sourcePaper.type': 'PYQ', isPyq: true } });
  const bytes = await imageZip({ id: 'bilingual', images: [{ ...imageMapping, questionId: 'b1', target: 'option', option: 'C', language: 'bn' }] });
  const saved = await zipRequest(bytes, { id: 'bilingual', action: 'apply' });
  expect(saved.status, await saved.clone().text()).toBe(200);
  const stored = await db.collection('mockSlots').findOne({ id: 'bilingual' });
  const question = stored.sourcePaper.sections.math.questions[0];
  expect(question.options.en).toEqual(bilingual.sourcePaper.sections.math.questions[0].options.en);
  expect(question.options.bn[2]).toContain('![Option C]'); expect(question.answer).toBe('A');
  expect(stored.sourcePaper.sections.math.duration).toBe(15);
  const built = await buildPaper({ examSlug: 'ssc-cgl', testId: 'bilingual' });
  expect(built.clientPaper.sections[0].questions[0].translations.options.bn[2]).toContain('/api/upload/image/');
  expect(await zipStatus('bilingual')).toBe(true);
});

it('replaces legacy object and parallel option images without retaining a second old image', async () => {
  await db.collection('mockSlots').updateOne({ id: 'paper100' }, { $set: {
    'fixedQuestions.0.options.1': { id: 'B', text: 'Two', image: '/old-object.png' },
    'fixedQuestions.0.optionImages': ['/keep-a.png', '/old-parallel.png', null, null],
  } });
  const initial = await load('paper100');
  expect(initial.optionImageStatus.q1.en).toEqual([true, true, false, false]);
  const bytes = await imageZip({ images: [{ ...imageMapping, target: 'option', option: 'B', language: 'en' }] });
  const response = await zipRequest(bytes, { action: 'apply' });
  expect(response.status, await response.clone().text()).toBe(200);
  const stored = await db.collection('mockSlots').findOne({ id: 'paper100' });
  expect(stored.fixedQuestions[0].options[1]).toMatchObject({ id: 'B', text: expect.stringContaining('![Option B]') });
  expect(stored.fixedQuestions[0].options[1].image).toBeUndefined();
  expect(stored.fixedQuestions[0].optionImages).toEqual(['/keep-a.png', null, null, null]);
  expect((await load('paper100')).optionImageStatus.q1.en).toEqual([true, true, false, false]);
});

it.each([
  ['missing manifest', { manifest: false }, 'manifest.json'],
  ['wrong paper', { id: 'other' }, 'does not match'],
  ['unknown question', { images: [{ ...imageMapping, questionId: 'q999' }] }, 'Unknown question'],
  ['duplicate target', { images: [imageMapping, imageMapping] }, 'Duplicate target'],
  ['missing image', { images: [{ ...imageMapping, file: 'images/missing.png' }], files: {} }, 'Missing image'],
  ['invalid image', { files: { 'images/question.png': 'fake' } }, 'cannot decode'],
  ['wrong extension', { images: [{ ...imageMapping, file: 'images/question.webp' }] }, 'Unexpected file'],
  ['invalid language', { images: [{ ...imageMapping, target: 'option', option: 'A', language: 'bn' }] }, 'does not exist'],
  ['invalid option', { images: [{ ...imageMapping, target: 'option', option: 'H', language: 'en' }] }, 'does not exist'],
  ['extra file', { files: { 'images/question.png': 'fake', 'unused.txt': 'unused' } }, 'Unexpected file'],
  ['traversal', { files: { '../bad.txt': 'bad' } }, 'Unsafe'],
])('rejects ZIP %s before storage or paper writes', async (_name, options, message) => {
  const response = await zipRequest(await imageZip(options), { action: 'apply' });
  expect(response.status).toBeGreaterThanOrEqual(400);
  expect((await response.json()).error).toContain(message);
  expect(putObject).not.toHaveBeenCalled();
  expect((await db.collection('mockSlots').findOne({ id: 'paper100' })).updatedAt).toBe(stamp);
});

it('requires admin access and the correct exam mode for ZIPs', async () => {
  const bytes = await imageZip();
  expect((await zipRequest(bytes, { admin: false })).status).toBe(403);
  expect((await zipRequest(bytes, { mode: 'iit-jam' })).status).toBe(400);
  expect(putObject).not.toHaveBeenCalled();
});

it('cleans attempted B2 objects after upload failures and leaves the paper untouched', async () => {
  putObject.mockRejectedValueOnce(new Error('B2 unavailable'));
  const response = await zipRequest(await imageZip(), { action: 'apply' });
  expect(response.status).toBe(503);
  expect((await response.json()).error).toContain('No paper changes were saved');
  expect(deleteObject).toHaveBeenCalledWith(putObject.mock.calls[0][0]);
  expect((await db.collection('mockSlots').findOne({ id: 'paper100' })).updatedAt).toBe(stamp);
});

it('cleans uploaded objects when the paper changes during B2 upload', async () => {
  putObject.mockImplementationOnce(async () => {
    await db.collection('mockSlots').updateOne({ id: 'paper100' }, { $set: { updatedAt: 'concurrent-version' } });
  });
  const response = await zipRequest(await imageZip(), { action: 'apply' });
  expect(response.status).toBe(409); expect(deleteObject).toHaveBeenCalledTimes(1);
  const stored = await db.collection('mockSlots').findOne({ id: 'paper100' });
  expect(stored.fixedQuestions).toEqual(questions);
});
