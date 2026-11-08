import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import express from 'express';
import sharp from 'sharp';
import { once } from 'node:events';

const b2State = vi.hoisted(() => ({
  putCommands: [],
  getCommands: [],
}));

vi.mock('../../config/b2.js', () => ({
  B2_BUCKET: 'test-storage-boundary-bucket',
  b2Client: {
    send: vi.fn(async (cmd) => {
      b2State.putCommands.push(cmd);
      return {};
    }),
  },
}));

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async (_client, cmd) => {
    b2State.getCommands.push(cmd);
    return 'https://b2.example.com/signed-object-url';
  }),
}));

vi.mock('../../services/questions/questionWriteService.js', () => ({
  createQuestion: vi.fn(async (doc) => doc),
}));

vi.mock('../../services/questions/questionExamMode.js', () => ({
  assertQuestionExamMode: vi.fn(() => {}),
}));

import { connectMongoDB, disconnectMongoDB } from '../../config/mongodb.js';
import { createSession, evictUserSessionCache } from '../../auth/sessions.js';
import {
  getPdfId,
  getBlobPathFromPdfId,
  isDocumentBlob,
  getB2Key,
} from '../../services/documents/pdfDocumentModel.js';
import { uploadImageQuestion } from '../../controllers/imageQuestionController.js';
import { trackPendingNoteImage } from '../../repositories/noteImageRepository.js';
import pdfsRouter from '../../routes/pdfs.js';
import notesRouter from '../../routes/notes.routes.js';
import { errorHandler } from '../../middleware/errorHandler.js';

const createMockRes = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

describe('FINDING-02 Regression: Storage Boundary, Path Traversal & Object Ownership Verification', () => {
  let mongo;
  let db;
  let server;
  let baseUrl;
  const tokens = {};

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    vi.stubEnv('MONGODB_URI', mongo.getUri());
    vi.stubEnv('MONGODB_DB', 'finding02_storage_boundary');
    db = await connectMongoDB();

    const app = express();
    app.use(express.json());
    app.use('/api/pdfs', pdfsRouter);
    app.use('/api/notes', notesRouter);
    app.use(errorHandler);

    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  }, 60000);

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectMongoDB();
    if (mongo) {
      await mongo.stop();
    }
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    b2State.putCommands.length = 0;
    b2State.getCommands.length = 0;
    for (const col of ['users', 'authSessions', 'notes', 'noteImages']) {
      await db.collection(col).deleteMany({});
    }
    for (const userId of ['admin_a', 'admin_b']) {
      await evictUserSessionCache(userId);
      await db.collection('users').insertOne({
        id: userId,
        role: 'admin',
        status: 'active',
        email: `${userId}@example.test`,
      });
      tokens[userId] = (await createSession({ id: userId })).token;
    }
  });

  describe('1. PDF Stream Boundary & Allowed Document Prefixes', () => {
    it('EXPLOIT REPRODUCTION: rejects path traversal, reserved prefixes, and invalid categories in GET /api/pdfs/stream/:id', async () => {
      const maliciousPaths = [
        '../question-images/q_1/question.pdf',
        'algebra/../../notes/images/secret.pdf',
        'algebra\\notes\\secret.pdf',
        'algebra//notes/secret.pdf',
        'question-images/q_1/secret.pdf',
        'solution-images/s_1/secret.pdf',
        'notes/images/pending/u1/secret.pdf',
        'quiz-pdfs/algebra/notes/secret.pdf',
        'tutor-jobs/job_1/attachment.pdf',
        'algebra/unapproved-category/file.pdf',
        'algebra/notes/nested/deep/file.pdf',
        'standalone.pdf',
        'algebra/notes/.hidden.pdf',
      ];

      for (const badPath of maliciousPaths) {
        expect(isDocumentBlob(badPath)).toBe(false);
        const encodedId = getPdfId(badPath);
        expect(getBlobPathFromPdfId(encodedId)).toBeNull();

        const res = await fetch(`${baseUrl}/api/pdfs/stream/${encodedId}`);
        expect(res.status).toBe(404);
      }

      expect(b2State.getCommands).toHaveLength(0);
    });

    it('rejects traversal segments directly in getB2Key', () => {
      expect(() => getB2Key('../question-images/secret.pdf')).toThrow();
      expect(() => getB2Key('algebra/../other/file.pdf')).toThrow();
      expect(() => getB2Key('/absolute/path.pdf')).toThrow();
      expect(() => getB2Key('algebra\\notes\\file.pdf')).toThrow();
    });

    it('preserves valid 3-segment and legacy 2-segment PDF/DOC/DOCX paths', async () => {
      for (const validPath of [
        'algebra/notes/formulas.pdf',
        'number-system/dpp/practice-set-1.docx',
        'trigonometry/formula/identities.doc',
        'percentages/legacy-notes.pdf',
      ]) {
        expect(isDocumentBlob(validPath)).toBe(true);
        const encodedId = getPdfId(validPath);
        expect(getBlobPathFromPdfId(encodedId)).toBe(validPath);

        const res = await fetch(`${baseUrl}/api/pdfs/stream/${encodedId}`);
        expect(res.status).toBe(200);
      }
      expect(b2State.getCommands).toHaveLength(4);
    });
  });

  describe('2. uploadImageQuestion Topic Path Traversal Prevention', () => {
    it('EXPLOIT REPRODUCTION: rejects topic containing path traversal or slashes before uploading to B2', async () => {
      const validPng = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .png()
        .toBuffer();

      for (const maliciousTopic of [
        '../../quiz-pdfs/algebra/notes',
        '../notes/images/pending/admin_a',
        'algebra/subtopic',
        'algebra\\subtopic',
      ]) {
        const req = {
          files: {
            questionImage: [{ buffer: validPng, mimetype: 'image/png', originalname: 'q.png' }],
          },
          body: {
            topic: maliciousTopic,
            correctLetter: 'a',
          },
          query: {},
        };
        const res = createMockRes();

        await uploadImageQuestion(req, res);
        expect(res.statusCode).toBe(400);
      }

      expect(b2State.putCommands).toHaveLength(0);
    });

    it('sanitizes human-readable topic names into safe question-images keys', async () => {
      const validPng = await sharp({
        create: { width: 64, height: 64, channels: 3, background: { r: 10, g: 20, b: 30 } },
      })
        .png()
        .toBuffer();

      const req = {
        files: {
          questionImage: [{ buffer: validPng, mimetype: 'image/png', originalname: 'q.png' }],
        },
        body: {
          topic: 'Visual Reasoning & Cubes',
          correctLetter: 'b',
        },
        query: {},
      };
      const res = createMockRes();

      await uploadImageQuestion(req, res);
      expect(res.statusCode).toBe(201);
      expect(b2State.putCommands).toHaveLength(1);
      const uploadedKey = b2State.putCommands[0].input.Key;
      expect(uploadedKey).toMatch(/^question-images\/visual_reasoning_cubes_\d+\/question\.webp$/);
    });
  });

  describe('3. Pending Note Image Object Ownership Verification', () => {
    it('EXPLOIT REPRODUCTION: prevents admin_b from attaching a pending note image uploaded by admin_a', async () => {
      const ownerA = Buffer.from('admin_a').toString('base64url');
      const keyOwnedByA = `notes/images/pending/${ownerA}/11111111-2222-3333-4444-555555555555.webp`;
      await trackPendingNoteImage(keyOwnedByA, 'admin_a');

      const imageUrl = `/api/upload/image/${Buffer.from(keyOwnedByA).toString('base64url')}`;

      // admin_b attempts to steal admin_a's pending image into a new note
      const stealAttempt = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.admin_b}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Stolen Image Note',
          body: `<p><img src="${imageUrl}"></p>`,
        }),
      });
      expect(stealAttempt.status).toBe(403);
      expect(await db.collection('notes').countDocuments()).toBe(0);

      // Pending image remains in pending state owned by admin_a
      const imageRecord = await db.collection('noteImages').findOne({ _id: keyOwnedByA });
      expect(imageRecord).toMatchObject({
        userId: 'admin_a',
        state: 'pending',
      });

      // admin_a can legitimately attach their own pending image
      const legitimateCreate = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.admin_a}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Owner Note',
          body: `<p><img src="${imageUrl}"></p>`,
        }),
      });
      expect(legitimateCreate.status).toBe(201);
      const createdNote = await legitimateCreate.json();

      // Another admin (admin_b) can edit text on the existing note without failing on its already-attached image
      const legitimateEdit = await fetch(`${baseUrl}/api/notes/${createdNote.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokens.admin_b}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Updated Title by Admin B',
          body: `<p>Updated text <img src="${imageUrl}"></p>`,
        }),
      });
      expect(legitimateEdit.status).toBe(200);

      // But admin_b still cannot inject a new pending image belonging to admin_a during PUT
      const secondKeyOwnedByA = `notes/images/pending/${ownerA}/66666666-7777-8888-9999-000000000000.webp`;
      await trackPendingNoteImage(secondKeyOwnedByA, 'admin_a');
      const secondUrl = `/api/upload/image/${Buffer.from(secondKeyOwnedByA).toString('base64url')}`;

      const forbiddenPut = await fetch(`${baseUrl}/api/notes/${createdNote.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${tokens.admin_b}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          body: `<p><img src="${imageUrl}"><img src="${secondUrl}"></p>`,
        }),
      });
      expect(forbiddenPut.status).toBe(403);
    });
  });
});
