import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { Collection } from 'mongodb';
import express from 'express';
import { once } from 'node:events';
import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createSession } from '../../auth/sessions.js';
import router from '../mocktest.js';
import { up as readinessIndexes } from '../../migrations/004-readiness.js';
import { uploadFullPaper, fetchAllAdminSlots } from '../../services/mockTestEngine.js';

vi.mock('../../services/mockPublicationNotificationService.js', () => ({ notifyNewMockPublished: vi.fn().mockResolvedValue(undefined) }));
let mongo, db, server, base;
let token;
async function request(path, method = 'GET', body, auth = token) {
  return fetch(`${base}${path}`, {
    method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
async function start() {
  const response = await request('/ssc-cgl/audit-test/start', 'POST');
  expect(response.status).toBe(201);
  return response.json();
}

const bilingualPaper = () => ({ exam: 'SSC_CHSL', tier: 2, type: 'MOCK', marksPerQuestion: 3, negativeMarks: 1,
  sections: Object.fromEntries(['english', 'computer', 'future_section'].map((key, i) => [key, { duration: i + 1, questions: [{
    id: `native-${i}`, question: { en: `Question ${i}`, bn: `প্রশ্ন ${i}` },
    options: { en: ['one', 'two', 'three', 'four'], bn: ['এক', 'দুই', 'তিন', 'চার'] },
    answer: 'B', solution: { en: 'Native secret solution', bn: 'গোপন সমাধান' },
  }] }])) });

describe('native schema paper HTTP lifecycle', () => {
  async function publish(paper = bilingualPaper()) {
    await db.collection('users').updateOne({ id: 'paper-admin' }, { $set: { id: 'paper-admin', role: 'admin', status: 'active' } }, { upsert: true });
    const adminToken = (await createSession({ id: 'paper-admin' })).token;
    return request('/admin/upload-paper?examMode=ssc', 'POST', { slot: { id: 'native-paper', title: 'Native bilingual paper' }, paper }, adminToken);
  }
  it('includes the saved exam date and numeric shift in the admin catalog', async () => {
    expect((await publish({ ...bilingualPaper(), type: 'PYQ', examDate: '2025-11-12', shift: 3 })).status).toBe(201);
    const slots = await fetchAllAdminSlots('all', 'ssc');
    expect(slots.find(slot => slot.id === 'native-paper')).toMatchObject({ examDate: '2025-11-12', year: 2025, shift: 3 });
  });
  it('accepts a raw schema with no slot, date or shift', async () => {
    await db.collection('users').updateOne({ id: 'raw-admin' }, { $set: { id: 'raw-admin', role: 'admin', status: 'active' } }, { upsert: true });
    const adminToken = (await createSession({ id: 'raw-admin' })).token;
    const response = await request('/admin/upload-paper?examMode=ssc', 'POST', bilingualPaper(), adminToken);
    expect(response.status).toBe(201);
    const result = await response.json();
    expect(result).toMatchObject({ examSlug: 'ssc-chsl', totalQuestions: 3, type: 'mock' });
    expect(result.slotId).toMatch(/^[a-f0-9-]{36}$/);
    expect((await request(`/ssc-chsl/${result.slotId}/start`, 'POST')).status).toBe(201);
  });
  it('starts a schema-only 100-question CHSL paper without falling back to the practice bank', async () => {
    const paper = { ...bilingualPaper(), tier: 1, type: 'PYQ', examDate: '2025-11-13', shift: 1 };
    const template = paper.sections.english.questions[0];
    paper.sections = Object.fromEntries(['math', 'english', 'reasoning', 'gk'].map((key, i) => [key,
      { duration: 15, questions: Array.from({ length: 25 }, (_, q) => ({ ...template, id: `${['m', 'e', 'r', 'g'][i]}${String(q + 1).padStart(3, '0')}` })) }]));
    await uploadFullPaper({ slotData: { id: 'chsl-pyq-2025-shift1', title: 'SSC CHSL 2025 Tier I 13 NOV (SHIFT 1) Official Paper' }, paper, examMode: 'ssc' });
    const stored = await db.collection('mockSlots').findOne({ id: 'chsl-pyq-2025-shift1' });
    expect(stored.fixedQuestions).toBeUndefined();
    expect(stored.sourcePaper).toBeDefined();
    const response = await request('/ssc-chsl/chsl-pyq-2025-shift1/start', 'POST');
    expect(response.status).toBe(201);
    const attempt = await response.json();
    expect(attempt.paper.sections.map(section => section.key)).toEqual(['math', 'english', 'reasoning', 'gk']);
    expect(attempt.paper.sections.flatMap(section => section.questions)).toHaveLength(100);
    expect(attempt.paper.compositeTimer).toBe(false);
    expect(attempt.sectionRemainingTimes.english).toBe(900);
    expect(attempt.sectionRemainingTimes.math).toBeGreaterThan(898);
    expect(JSON.stringify(attempt)).not.toMatch(/solution|answerKey/);
  });
  it('validates before saving, isolates practice questions and hides solutions in catalog and active attempts', async () => {
    const bad = bilingualPaper(); bad.sections.computer.questions[0].id = 'native-0';
    expect((await publish(bad)).status).toBe(422);
    expect(await db.collection('mockSlots').findOne({ id: 'native-paper' })).toBeNull();
    const result = await publish();
    expect(result.status).toBe(201);
    expect((await result.json()).insertedToBank).toBe(0);
    expect(await db.collection('questions').findOne({ id: 'native-0' })).toBeNull();
    const catalog = await (await request('/ssc-chsl/slots?catalog=1&kind=mock&tier=Tier%20II')).json();
    expect(catalog.slots[0]).toMatchObject({ hasFixedPaper: true, questionCount: 3, paperMetadata: { totalDurationMin: 6 } });
    expect(JSON.stringify(catalog)).not.toMatch(/sourcePaper|Native secret|গোপন/);
    const single = await (await request('/slots/native-paper?examSlug=ssc-chsl')).json();
    expect(JSON.stringify(single)).not.toMatch(/sourcePaper|Native secret|গোপন/);
    const response = await request('/ssc-chsl/native-paper/start', 'POST');
    expect(response.status).toBe(201);
    const attempt = await response.json();
    expect(attempt.paper.sections.map(section => section.key)).toEqual(['english', 'computer', 'future_section']);
    expect(attempt.sectionRemainingTimes.english).toBeGreaterThan(58);
    expect(attempt.sectionRemainingTimes.computer).toBe(120);
    expect(JSON.stringify(attempt)).not.toMatch(/solution|answerKey|Native secret|গোপন/);
  });
  it('resumes server timers, saves before advancing, locks previous answers and releases bilingual review only after submission', async () => {
    expect((await publish()).status).toBe(201);
    const attempt = await (await request('/ssc-chsl/native-paper/start', 'POST')).json();
    const save = (revision, body) => request(`/attempt/${attempt.id}/autosave`, 'PATCH', { baseRevision: revision - 1, revision, ...body });
    expect((await save(1, { currentSection: 0, currentQuestion: 0, language: 'bn', answers: { 'native-0': 'B' }, questionStatuses: { 'native-0': 'answered_marked' } })).status).toBe(200);
    await db.collection('mockAttempts').updateOne({ id: attempt.id }, { $set: { sectionStartedAt: new Date(Date.now() - 65000).toISOString() } });
    const resumed = await (await request(`/attempt/${attempt.id}`)).json();
    expect(resumed).toMatchObject({ currentSection: 1, language: 'bn', lockedSections: ['english'], answers: { 'native-0': 'B' } });
    expect(resumed.sectionRemainingTimes.english).toBe(0);
    expect(resumed.sectionRemainingTimes.computer).toBeLessThanOrEqual(115);
    // The first save persists the server's automatic move to the next section.
    await save(2, { currentSection: 1, currentQuestion: 0, answers: { 'native-0': 'A', 'native-1': 'A' }, questionStatuses: { 'native-1': 'answered' } });
    // Tampering with a locked answer must never change it.
    await save(3, { currentSection: 0, answers: { 'native-0': 'D' }, questionStatuses: {} });
    const locked = await (await request(`/attempt/${attempt.id}`)).json();
    expect(locked.answers).toEqual({ 'native-0': 'B', 'native-1': 'A' });
    expect((await save(4, { currentSection: 1, advanceSection: true, answers: locked.answers, questionStatuses: {} })).status).toBe(200);
    const advanced = await (await request(`/attempt/${attempt.id}`)).json();
    expect(advanced).toMatchObject({ currentSection: 2, lockedSections: ['english', 'computer'] });
    const submission = await (await request(`/attempt/${attempt.id}/submit`, 'POST')).json();
    expect(submission.result).toMatchObject({ totalScore: 2, maxScore: 9 });
    const review = await (await request(`/attempt/${attempt.id}`)).json();
    expect(review.answerKey['native-0']).toBe('B');
    expect(review.paper.sections[0].questions[0].translations.solution.bn).toBe('গোপন সমাধান');
  });
  it('refuses late edits to an expired section before any other client has saved the transition', async () => {
    expect((await publish()).status).toBe(201);
    const attempt = await (await request('/ssc-chsl/native-paper/start', 'POST')).json();
    await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 1, currentSection: 0, answers: { 'native-0': 'B' } });
    await db.collection('mockAttempts').updateOne({ id: attempt.id }, { $set: { sectionStartedAt: new Date(Date.now() - 65000).toISOString() } });
    const save = await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { baseRevision: 1, revision: 2, currentSection: 0, advanceSection: true, answers: { 'native-0': 'D' } });
    expect(save.status).toBe(200);
    const resumed = await (await request(`/attempt/${attempt.id}`)).json();
    expect(resumed.currentSection).toBe(1);
    expect(resumed.answers['native-0']).toBe('B');
  });
});

describe('paged mock catalog', () => {
  it('sorts PYQs by date and numeric shift before paging, including older title-based papers', async () => {
    const papers = [
      { id: 'nov-19', title: '2025 Tier I 19 NOV (SHIFT 2) Official Paper' },
      { id: 'nov-12-10', title: '2025 Tier I 12 NOV (SHIFT 10) Official Paper' },
      { id: 'nov-13', examDate: '2025-11-13', shift: 1 },
      { id: 'nov-12-3', title: '2025 Tier I 12 NOV (SHIFT 3) Official Paper' },
      { id: 'nov-12-2', examDate: '2025-11-12', shift: 'Shift 2' },
      { id: 'oct-31', title: '2025 Tier I 31 OCTOBER (SHIFT 1) Official Paper' },
      { id: 'unknown', title: '2025 Official Paper' },
      { id: 'previous', year: 2024, examDate: '2024-12-31', shift: 1 },
    ];
    await db.collection('mockSlots').insertMany(papers.map((paper, order) => ({
      examSlug: 'sort-exam', type: 'pyq', tier: 'Tier I', year: 2025, order, ...paper,
    })));
    const ids = [];
    let offset = 0;
    do {
      const page = await (await request(`/sort-exam/slots?catalog=1&kind=pyq&limit=2&offset=${offset}`)).json();
      ids.push(...page.slots.map(slot => slot.id));
      expect(JSON.stringify(page.slots)).not.toMatch(/_sort|_titleDate|_shiftMatch|_examDate/);
      offset = page.nextOffset;
    } while (offset !== null);
    expect(ids).toEqual(['oct-31', 'nov-12-2', 'nov-12-3', 'nov-12-10', 'nov-13', 'nov-19', 'unknown', 'previous']);
  });

  it('filters years before pagination and combines them with tier selection', async () => {
    await db.collection('mockSlots').insertMany(Array.from({ length: 65 }, (_, i) => ({
      id: `year-${i}`, examSlug: 'year-exam', order: i, type: 'pyq',
      tier: i < 60 ? 'Tier I' : 'Tier II', year: i < 30 ? 2024 : '2025',
    })));
    const metadata = await (await request('/year-exam/slots?catalog=1&limit=0')).json();
    expect(metadata.metadata.years).toEqual([2025, 2024]);
    const path = '/year-exam/slots?catalog=1&kind=pyq&tier=Tier%20I&year=2025&limit=20';
    const first = await (await request(path)).json();
    expect(first.total).toBe(30);
    expect(first.slots).toHaveLength(20);
    expect(first.slots.every(slot => String(slot.year) === '2025' && slot.tier === 'Tier I')).toBe(true);
    const second = await (await request(`${path}&offset=${first.nextOffset}`)).json();
    expect(second.slots).toHaveLength(10);
    expect(second.nextOffset).toBeNull();
    expect(new Set([...first.slots, ...second.slots].map(slot => slot.id)).size).toBe(30);
    const empty = await (await request(path.replace('2025', '2023'))).json();
    expect(empty.slots).toEqual([]);
    expect(empty.metadata.years).toEqual([2025, 2024]);
    expect((await request(path.replace('2025', 'bad'))).status).toBe(400);
  });

  it('returns saved-count metadata separately and pages over 100 papers without leaking questions', async () => {
    await db.collection('mockSlots').insertMany(Array.from({ length: 125 }, (_, i) => ({
      id: `paged-${String(i).padStart(3, '0')}`, examSlug: 'paged-exam', order: Math.floor(i / 2),
      tier: i < 105 ? 'Tier I' : 'Tier II', type: i < 105 ? 'mock' : 'pyq',
      fixedQuestions: [{ correctAnswer: 'secret' }],
    })));
    const metadata = await (await request('/paged-exam/slots?catalog=1&limit=0')).json();
    expect(metadata.slots).toEqual([]);
    expect(metadata.metadata).toEqual({ mockCount: 105, pyqCount: 20, tiers: ['Tier I', 'Tier II'], years: [] });
    const ids = [];
    let offset = 0;
    do {
      const page = await (await request(`/paged-exam/slots?catalog=1&kind=mock&tier=Tier%20I&offset=${offset}&limit=20`)).json();
      expect(page.slots.length).toBeLessThanOrEqual(20);
      expect(JSON.stringify(page)).not.toContain('secret');
      expect(page.slots[0].questionCount).toBe(1);
      ids.push(...page.slots.map(slot => slot.id));
      offset = page.nextOffset;
    } while (offset !== null);
    expect(ids).toHaveLength(105);
    expect(new Set(ids).size).toBe(105);
    const pyqs = await (await request('/paged-exam/slots?catalog=1&kind=pyq&tier=Tier%20II')).json();
    expect(pyqs.slots).toHaveLength(20);
    expect(pyqs.nextOffset).toBeNull();
    expect((await request('/paged-exam/slots?catalog=1&limit=1000')).status).toBe(400);
  });
});
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  process.env.MONGODB_URI = mongo.getUri();
  process.env.MONGODB_DB = 'mock_audit';
  db = await connectMongoDB();
  await readinessIndexes(db);
  const app = express();
  app.use(express.json());
  app.use(router);
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}, 60000);
beforeEach(async () => {
  await db.collection('users').updateOne({ id: 'student' }, { $set: { id: 'student' } }, { upsert: true });
  token = (await createSession({ id: 'student' })).token;
  await db.collection('mockAttempts').deleteMany({});
  await db.collection('mockSlots').deleteMany({});
  await db.collection('mockSlots').insertOne({
    id: 'audit-test', examSlug: 'ssc-cgl', configKey: 'ssc-cgl-tier1', title: 'Audit test',
    fixedQuestions: ['quant', 'ga', 'reasoning', 'english'].map(key => ({
      id: key, sectionKey: key, question: 'Two plus two?', options: ['3', '4', '5', '6'],
      correctAnswer: 'B', solution: 'The answer is four', solutionImage: '/secret.png',
      explanation: 'Private explanation', correctIndex: 1,
    })),
  });
});
afterAll(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await disconnectMongoDB();
  await mongo?.stop();
});

describe('mock test HTTP and MongoDB contract', () => {
  it('restarts only the current user and paper, retaining results and rejecting old progress saves', async () => {
    const old = await start();
    await request(`/attempt/${old.id}/autosave`, 'PATCH', { revision: 1, answers: { quant: '1' } });
    const completed = await start();
    await request(`/attempt/${completed.id}/submit`, 'POST');
    const untouched = [
      { id: 'another-user', userId: 'other-user', examSlug: 'ssc-cgl', testId: 'audit-test' },
      { id: 'another-paper', userId: 'student', examSlug: 'ssc-cgl', testId: 'other-paper' },
      { id: 'another-exam', userId: 'student', examSlug: 'ssc-chsl', testId: 'audit-test' },
    ];
    await db.collection('mockAttempts').insertMany(untouched.map(doc => ({ ...doc, status: 'in_progress' })));
    const restart = () => fetch(`${base}/ssc-cgl/audit-test/start`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'restart-this-paper' }, body: JSON.stringify({ restart: true }),
    });
    const response = await restart();
    expect(response.status).toBe(201);
    const fresh = await response.json();
    expect(fresh.id).not.toBe(old.id);
    expect(fresh).toMatchObject({ answers: {}, questionStatuses: {}, revision: 0, currentQuestion: 0, currentSection: 0, status: 'in_progress' });
    expect(new Date(fresh.deadlineAt).getTime()).toBeGreaterThan(Date.now() + 59 * 60 * 1000);
    expect((await db.collection('mockAttempts').findOne({ id: old.id })).status).toBe('abandoned');
    expect((await db.collection('mockAttempts').findOne({ id: completed.id })).status).toBe('completed');
    for (const doc of untouched) expect((await db.collection('mockAttempts').findOne({ id: doc.id })).status).toBe('in_progress');
    expect((await request(`/attempt/${old.id}/autosave`, 'PATCH', { revision: 2, answers: {} })).status).toBe(409);
    expect((await request(`/attempt/${old.id}/submit`, 'POST')).status).toBe(409);
    expect((await (await restart()).json()).id).toBe(fresh.id);
    expect(await db.collection('mockAttempts').countDocuments({ userId: 'student', examSlug: 'ssc-cgl', testId: 'audit-test', status: 'in_progress' })).toBe(1);
  });

  it('refuses a restart for a one-attempt assessment and keeps its progress', async () => {
    const fixedQuestions = ['ga', 'reasoning', 'quant', 'english'].flatMap(sectionKey => Array.from({ length: 25 }, (_, i) => ({
      id: `${sectionKey}-${i}`, sectionKey, question: 'Question', options: ['one', 'two'], correctAnswer: 1,
    })));
    await db.collection('mockSlots').updateOne({ id: 'audit-test' }, { $set: { assessmentMode: 'confidential', fixedQuestions } });
    const old = await start();
    const response = await fetch(`${base}/ssc-cgl/audit-test/start`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Idempotency-Key': 'restart-not-allowed' }, body: JSON.stringify({ restart: true }),
    });
    expect(response.status).toBe(403);
    expect((await db.collection('mockAttempts').findOne({ id: old.id })).status).toBe('in_progress');
    expect(await db.collection('mockAttempts').countDocuments({ userId: 'student', testId: 'audit-test' })).toBe(1);
  });

  it('reads the fixed slot once when starting an attempt', async () => {
    const original = Collection.prototype.findOne;
    const reads = [];
    const spy = vi.spyOn(Collection.prototype, 'findOne').mockImplementation(function (...args) {
      if (this.collectionName === 'mockSlots') reads.push(args[0]);
      return original.apply(this, args);
    });
    try {
      const attempt = await start();
      expect(attempt.paper.sections.flatMap(section => section.questions)).toHaveLength(4);
      expect(reads).toEqual([{ id: 'audit-test', examSlug: 'ssc-cgl' }]);
    } finally { spy.mockRestore(); }
  });
  it('advances the shared question revision after publishing a practice paper', async () => {
    const before = (await db.collection('questionMetadata').findOne({ _id: 'revision' }))?.revision ?? 0;
    const uploaded = await uploadFullPaper({
      slotData: { id: 'public-revision', title: 'Public revision test', examSlug: 'ssc-cgl', configKey: 'ssc-cgl-tier1' },
      questions: [{ id: 'public-revision-q1', section: 'quant', topic: 'percentages', subject: 'mathematics', question: 'Two plus two?', options: ['3', '4'], correctAnswer: 'B' }],
    });
    expect(uploaded.insertedToBank).toBe(1);
    expect((await db.collection('questionMetadata').findOne({ _id: 'revision' })).revision).toBe(before + 1);
  });

  it('keeps confidential uploads out of the practice bank and refuses a public downgrade', async () => {
    const questions = ['ga', 'reasoning', 'quant', 'english'].flatMap(section => Array.from({ length: 25 }, (_, i) => ({
      id: `private-${section}-${i}`, section, question: 'Question', options: ['one', 'two'], correctAnswer: 1,
    })));
    const slot = { id: 'private-upload', title: 'Private', examSlug: 'ssc-cgl', configKey: 'ssc-cgl-tier1', assessmentMode: 'confidential' };
    const uploaded = await uploadFullPaper({ slotData: slot, questions });
    expect(uploaded.insertedToBank).toBe(0);
    expect(await db.collection('questions').countDocuments({ id: { $in: questions.map(question => question.id) } })).toBe(0);
    await expect(uploadFullPaper({ slotData: { ...slot, assessmentMode: 'practice' }, questions })).rejects.toMatchObject({ statusCode: 422 });
  });
  it('enforces confidential paper completeness, one attempt and no completed answer review', async () => {
    await db.collection('mockSlots').updateOne({ id: 'audit-test' }, { $set: { assessmentMode: 'confidential' } });
    expect((await request('/ssc-cgl/audit-test/start', 'POST')).status).toBe(422);
    const fixedQuestions = ['ga', 'reasoning', 'quant', 'english'].flatMap(sectionKey => Array.from({ length: 25 }, (_, i) => ({
      id: `${sectionKey}-${i}`, sectionKey, question: 'Question', options: ['one', 'two'], correctAnswer: 1, solution: 'secret solution',
    })));
    await db.collection('mockSlots').updateOne({ id: 'audit-test' }, { $set: { fixedQuestions } });
    const attempts = await Promise.all(Array.from({ length: 4 }, async () => (await request('/ssc-cgl/audit-test/start', 'POST')).json()));
    expect(new Set(attempts.map(item => item.id)).size).toBe(1);
    const id = attempts[0].id;
    await request(`/attempt/${id}/submit`, 'POST');
    const completed = await (await request(`/attempt/${id}`)).json();
    expect(completed.status).toBe('completed');
    expect(completed.answerKey).toBeUndefined();
    expect(JSON.stringify(completed)).not.toContain('secret solution');
    expect((await (await request('/ssc-cgl/audit-test/start', 'POST')).json()).id).toBe(id);
  });

  it('rejects stale compare-and-swap saves rather than overwriting a different tab', async () => {
    const attempt = await start();
    await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { baseRevision: 0, revision: 1, answers: { quant: '1' } });
    const stale = await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { baseRevision: 0, revision: 2, answers: { quant: '0' } });
    expect(stale.status).toBe(409);
    expect((await stale.json()).code).toBe('REVISION_CONFLICT');
  });

  it('reuses an idempotent start across concurrent retries', async () => {
    const responses = await Promise.all(Array.from({ length: 4 }, () => fetch(`${base}/ssc-cgl/audit-test/start`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Idempotency-Key': 'same-start-request' },
    })));
    const attempts = await Promise.all(responses.map(response => response.json()));
    expect(new Set(attempts.map(attempt => attempt.id)).size).toBe(1);
  });
  it('hides fixed answers from public details and solutions from start/resume while retaining completed review', async () => {
    const slot = await (await request('/slots/audit-test')).json();
    expect(slot.slot.fixedQuestions).toBeUndefined();
    expect(slot.slot.hasFixedPaper).toBe(true);
    const attempt = await start();
    for (const payload of [attempt, await (await request(`/attempt/${attempt.id}`)).json()]) {
      expect(payload.answerKey).toBeUndefined();
      expect(payload.paper.sections.flatMap(section => section.questions)).toHaveLength(4);
      expect(JSON.stringify(payload)).not.toMatch(/secret.png|Private explanation|correctIndex|The answer is four/);
    }
    await request(`/attempt/${attempt.id}/submit`, 'POST');
    const reviewed = await (await request(`/attempt/${attempt.id}`)).json();
    expect(reviewed.answerKey.quant).toBe('1');
    expect(JSON.stringify(reviewed.paper)).toContain('The answer is four');
  });

  it('grades UI indices against letter keys and makes simultaneous submissions idempotent', async () => {
    const attempt = await start();
    expect((await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 1, answers: { quant: '1' } })).status).toBe(200);
    const responses = await Promise.all(Array.from({ length: 5 }, () => request(`/attempt/${attempt.id}/submit`, 'POST')));
    expect(responses.every(response => response.status === 200)).toBe(true);
    const results = await Promise.all(responses.map(response => response.json()));
    expect(results.every(value => value.result.totalScore === 2)).toBe(true);
    expect(new Set(results.map(value => JSON.stringify(value.result))).size).toBe(1);
    expect((await db.collection('mockAttempts').findOne({ id: attempt.id })).status).toBe('completed');
  });

  it('recovers a legacy submission left behind by a crashed process', async () => {
    const attempt = await start();
    await db.collection('mockAttempts').updateOne({ id: attempt.id }, { $set: { status: 'submitting', submitClaimedAt: new Date(0) } });
    expect((await request(`/attempt/${attempt.id}/submit`, 'POST')).status).toBe(200);
  });

  it('refuses to publish a grade if an autosave changes the snapshot during grading', async () => {
    const attempt = await start();
    let release, entered;
    const gate = new Promise(resolve => { release = resolve; });
    const started = new Promise(resolve => { entered = resolve; });
    const original = Collection.prototype.countDocuments;
    const spy = vi.spyOn(Collection.prototype, 'countDocuments').mockImplementation(async function (...args) {
      entered();
      await gate;
      return original.apply(this, args);
    });
    const submitting = request(`/attempt/${attempt.id}/submit`, 'POST');
    try {
      await started;
      await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 1, answers: { quant: '1' } });
      release();
      expect((await submitting).status).toBe(409);
    } finally { release(); spy.mockRestore(); }
    const retry = await (await request(`/attempt/${attempt.id}/submit`, 'POST')).json();
    expect(retry.result.totalScore).toBe(2);
  });

  it('rejects expired autosaves but allows submission, and isolates ownership', async () => {
    const attempt = await start();
    await db.collection('mockAttempts').updateOne({ id: attempt.id }, { $set: { deadlineAt: new Date(0) } });
    const save = await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 1, answers: { quant: '1' } });
    expect(save.status).toBe(409);
    expect((await save.json()).expired).toBe(true);
    await db.collection('users').insertOne({ id: 'other-student' });
    const other = (await createSession({ id: 'other-student' })).token;
    expect((await request(`/attempt/${attempt.id}`, 'GET', undefined, other)).status).toBe(404);
    expect((await request(`/attempt/${attempt.id}/submit`, 'POST', undefined, other)).status).toBe(404);
    expect((await request(`/attempt/${attempt.id}/submit`, 'POST')).status).toBe(200);
  });

  it('does not allow older autosaves to overwrite newer answers or completed attempts', async () => {
    const attempt = await start();
    await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 2, answers: { quant: '1' } });
    await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 1, answers: { quant: '0' } });
    await request(`/attempt/${attempt.id}/submit`, 'POST');
    expect((await request(`/attempt/${attempt.id}/autosave`, 'PATCH', { revision: 3, answers: {} })).status).toBe(409);
    const stored = await db.collection('mockAttempts').findOne({ id: attempt.id });
    expect(stored.answers).toEqual({ quant: '1' });
    expect(stored.result.totalScore).toBe(2);
  });
});
