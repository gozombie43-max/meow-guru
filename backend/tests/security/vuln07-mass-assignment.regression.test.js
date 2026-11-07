import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { once } from 'node:events';

const notesState = vi.hoisted(() => ({
  inserted: [],
  patched: [],
  storedNote: {
    _id: 'mongo_internal_id_123',
    _cosmosRid: 'cosmos_rid_secret',
    ownerUserId: 'admin_internal_owner',
    id: 'note-123',
    title: 'Algebra Basics',
    topic: 'algebra',
    type: 'notes',
    body: '<p>x + y = z</p>',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
}));

const mockTestState = vi.hoisted(() => ({
  updates: [],
}));

vi.mock('../../middleware/auth.js', () => ({
  default: (req, _res, next) => {
    req.user = { id: 'admin_1', role: 'admin' };
    next();
  },
  adminAuth: (req, _res, next) => {
    req.user = { id: 'admin_1', role: 'admin' };
    next();
  },
}));

vi.mock('../../repositories/notesRepository.js', () => ({
  listNotePage: vi.fn(async () => ({ items: [notesState.storedNote], nextCursor: null })),
  listNotes: vi.fn(async () => [notesState.storedNote]),
  findNoteById: vi.fn(async (id) => (id === 'note-123' ? { ...notesState.storedNote } : null)),
  insertNote: vi.fn(async (note) => {
    notesState.inserted.push(note);
    return { insertedId: 'new_id' };
  }),
  patchNoteDocument: vi.fn(async (_id, patch) => {
    notesState.patched.push(patch);
    return { modifiedCount: 1 };
  }),
  deleteNoteById: vi.fn(async () => ({ deletedCount: 1 })),
}));

vi.mock('../../repositories/noteImageRepository.js', () => ({
  retainNoteImages: vi.fn(async () => {}),
  scheduleNoteImageCleanup: vi.fn(async () => {}),
}));

vi.mock('../../repositories/mockTestRepository.js', () => ({
  getOwnedAttempt: vi.fn(async (attemptId, userId) => ({
    _id: 'attempt_mongo_1',
    id: attemptId,
    userId,
    status: 'in_progress',
    revision: 1,
    currentSection: 0,
    currentQuestion: 0,
    answers: {},
    questionStatuses: {},
    paper: {
      compositeTimer: true,
      sections: [
        {
          key: 'quant',
          questions: [{ id: 'q1' }],
        },
      ],
    },
  })),
  updateAttemptProgress: vi.fn(async (_filter, update) => {
    mockTestState.updates.push(update);
    return { modifiedCount: 1 };
  }),
}));

import notesRouter from '../../routes/notes.routes.js';
import { autosaveAttempt } from '../../controllers/mockTestController.js';

describe('VULN-07 Regression: Mass Assignment & Unsanitized Document Persistence in Notes and MockTest Autosave', () => {
  beforeEach(() => {
    notesState.inserted.length = 0;
    notesState.patched.length = 0;
    mockTestState.updates.length = 0;
  });

  describe('1. Notes Route Sanitization & Allowlist Enforcement', () => {
    it('EXPLOIT REPRODUCTION: GET /api/notes/:id strips internal fields (_id, _cosmosRid, ownerUserId)', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/notes', notesRouter);
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      try {
        const res = await fetch(`http://127.0.0.1:${server.address().port}/api/notes/note-123`);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body._id).toBeUndefined();
        expect(body._cosmosRid).toBeUndefined();
        expect(body.ownerUserId).toBeUndefined();
        expect(body.id).toBe('note-123');
        expect(body.title).toBe('Algebra Basics');
      } finally {
        await new Promise((r) => server.close(r));
      }
    });

    it('EXPLOIT REPRODUCTION: POST /api/notes and PUT /api/notes/:id strip unallowed mass-assigned fields', async () => {
      const app = express();
      app.use(express.json());
      app.use('/api/notes', notesRouter);
      const server = app.listen(0, '127.0.0.1');
      await once(server, 'listening');
      const baseUrl = `http://127.0.0.1:${server.address().port}`;
      try {
        const createRes = await fetch(`${baseUrl}/api/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Trigonometry',
            topic: 'trig',
            type: 'formula',
            body: '<p>sin^2 + cos^2 = 1</p>',
            tags: ['math'],
            _id: 'injected_mongo_id',
            _cosmosRid: 'injected_rid',
            isAdmin: true,
            $where: 'this.secret == 1',
            arbitraryNestedObject: { malicious: 'payload' },
          }),
        });
        expect(createRes.status).toBe(201);
        expect(notesState.inserted.length).toBe(1);
        const insertedDoc = notesState.inserted[0];
        expect(insertedDoc.title).toBe('Trigonometry');
        expect(insertedDoc.topic).toBe('trig');
        expect(insertedDoc._id).toBeUndefined();
        expect(insertedDoc._cosmosRid).toBeUndefined();
        expect(insertedDoc.isAdmin).toBeUndefined();
        expect(insertedDoc.$where).toBeUndefined();
        expect(insertedDoc.arbitraryNestedObject).toBeUndefined();

        const updateRes = await fetch(`${baseUrl}/api/notes/note-123`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Updated Algebra',
            isAdmin: true,
            $set: { hacked: true },
            unallowedField: 'inject',
          }),
        });
        expect(updateRes.status).toBe(200);
        expect(notesState.patched.length).toBe(1);
        const patchedDoc = notesState.patched[0];
        expect(patchedDoc.title).toBe('Updated Algebra');
        expect(patchedDoc.isAdmin).toBeUndefined();
        expect(patchedDoc.$set).toBeUndefined();
        expect(patchedDoc.unallowedField).toBeUndefined();
      } finally {
        await new Promise((r) => server.close(r));
      }
    });
  });

  describe('2. MockTest Autosave sectionTimers Validation', () => {
    it('EXPLOIT REPRODUCTION: filters out non-numeric, nested object, and $-prefixed keys from sectionTimers', async () => {
      const req = {
        params: { attemptId: 'att_1' },
        user: { id: 'student_1' },
        body: {
          revision: 2,
          currentSection: 0,
          currentQuestion: 0,
          answers: { q1: 'A' },
          questionStatuses: { q1: 'answered' },
          sectionTimers: {
            quant: 450,
            english: 900,
            $ne: 'malicious_operator',
            nestedBlob: { huge: 'A'.repeat(5000) },
            negativeTimer: -100,
            excessiveTimer: 999999999,
          },
        },
      };
      const res = {
        statusCode: 200,
        body: null,
        status(c) {
          this.statusCode = c;
          return this;
        },
        json(p) {
          this.body = p;
          return this;
        },
      };

      await autosaveAttempt(req, res);
      expect(res.statusCode).toBe(200);
      expect(mockTestState.updates.length).toBe(1);
      const savedTimers = mockTestState.updates[0].$set.sectionTimers;
      expect(savedTimers).toEqual({
        quant: 450,
        english: 900,
      });
    });
  });
});
