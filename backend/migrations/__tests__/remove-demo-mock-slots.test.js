import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { MOCK_TEST_SLOTS, getSlotById, getSlotsForExam } from '../../config/exam-config.js';
import { up as seedDefaults } from '../018-default-mock-slots.js';
import * as cleanup from '../023-remove-demo-mock-slots.js';
import { migrations } from '../runner.js';

let mongo, client, db;
beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  client = await new MongoClient(mongo.getUri()).connect();
  db = client.db('remove_demo_mock_slots');
}, 60000);
afterAll(async () => { await client?.close(); await mongo?.stop(); });

it('removes untouched seeds while retaining uploaded, edited, custom and PYQ papers and attempts', async () => {
  const seed = {
    id: 'ssccgl-tieri-mock-1', examSlug: 'ssc-cgl', configKey: 'ssc-cgl-tier1',
    title: 'SSC CGL Tier I — Full Mock Test 1', tier: 'Tier I', isFree: true,
    order: 1, type: 'mock', createdAt: '2026-10-01', updatedAt: '2026-10-01',
  };
  const preserved = [
    { ...seed, fixedQuestions: [{ id: 'q1' }] },
    { ...seed, sourcePaper: { title: 'Uploaded paper' } },
    { ...seed, hasFixedPaper: true },
    { ...seed, paperMetadata: { schemaDriven: true } },
    { ...seed, questionCount: 100 },
    { ...seed, title: 'Admin paper' },
    { ...seed, isFree: false },
    { ...seed, updatedAt: '2026-10-02' },
    { ...seed, id: 'custom-paper' },
    { ...seed, type: 'pyq', isPyq: true },
    { ...seed, assessmentMode: 'confidential' },
  ].map((slot, index) => ({ ...slot, _id: `keep-${index}` }));
  await db.collection('mockSlots').insertMany([
    { ...seed, _id: 'demo' },
    { ...seed, _id: 'empty-demo', fixedQuestions: [] },
    ...preserved,
  ]);
  await db.collection('mockAttempts').insertOne({ id: 'existing-attempt', slotId: seed.id });

  expect(migrations).toContain(cleanup);
  await cleanup.up(db);
  expect(await db.collection('mockSlots').find().sort({ _id: 1 }).toArray())
    .toEqual(preserved.sort((a, b) => a._id.localeCompare(b._id)));
  expect(await db.collection('mockAttempts').countDocuments()).toBe(1);
  await cleanup.up(db);
  expect(await db.collection('mockSlots').countDocuments()).toBe(preserved.length);
});

it('does not regenerate demo defaults or resolve removed demo URLs', async () => {
  expect(MOCK_TEST_SLOTS).toEqual([]);
  expect(getSlotsForExam('ssc-cgl')).toEqual([]);
  expect(getSlotById('ssccgl-tieri-mock-1')).toBeNull();
  const countBefore = await db.collection('mockSlots').countDocuments();
  await seedDefaults(db);
  expect(await db.collection('mockSlots').countDocuments()).toBe(countBefore);
});
