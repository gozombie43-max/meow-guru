import { describe, it, expect, vi, beforeEach } from 'vitest';
import sharp from 'sharp';

const b2State = vi.hoisted(() => ({
  putCommands: [],
  getCommands: [],
}));

vi.mock('../../config/b2.js', () => ({
  B2_BUCKET: 'test-image-bucket',
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
    return 'https://b2.example.com/signed-image-url';
  }),
}));

vi.mock('../../services/questions/questionWriteService.js', () => ({
  createQuestion: vi.fn(async () => ({})),
}));

vi.mock('../../services/questions/questionExamMode.js', () => ({
  assertQuestionExamMode: vi.fn(() => {}),
}));

import {
  serveImage,
  uploadImageQuestion,
  uploadQuestionImage,
  uploadSolutionImage,
} from '../../controllers/imageQuestionController.js';

const createMockRes = () => {
  const res = {
    statusCode: 200,
    body: null,
    redirectStatus: null,
    redirectUrl: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    redirect(status, url) {
      this.redirectStatus = status;
      this.redirectUrl = url;
      return this;
    },
  };
  return res;
};

describe('VULN-06 Regression: B2 Image Key Path Traversal & Unbounded Image Decoding', () => {
  beforeEach(() => {
    b2State.putCommands.length = 0;
    b2State.getCommands.length = 0;
  });

  describe('1. serveImage Key Validation & Path Traversal Prevention', () => {
    it('EXPLOIT REPRODUCTION: rejects path traversal in base64url image ID (question-images/../../secret)', async () => {
      const traversalKey = 'question-images/../../quiz-pdfs/secret.pdf';
      const encodedId = Buffer.from(traversalKey, 'utf8').toString('base64url');
      const req = { params: { id: encodedId } };
      const res = createMockRes();

      await serveImage(req, res);
      expect(res.statusCode).toBe(404);
      expect(b2State.getCommands.length).toBe(0);
    });

    it('EXPLOIT REPRODUCTION: rejects non-image extension or malformed key under allowed prefix', async () => {
      const htmlKey = 'notes/images/exploit.html';
      const encodedId = Buffer.from(htmlKey, 'utf8').toString('base64url');
      const req = { params: { id: encodedId } };
      const res = createMockRes();

      await serveImage(req, res);
      expect(res.statusCode).toBe(404);
      expect(b2State.getCommands.length).toBe(0);
    });

    it('preserves valid question, solution, and note image keys', async () => {
      for (const validKey of [
        'question-images/q_123/question.webp',
        'solution-images/s_123/solution.webp',
        'notes/images/pending/u_1/abc-123.webp',
      ]) {
        const encodedId = Buffer.from(validKey, 'utf8').toString('base64url');
        const req = { params: { id: encodedId } };
        const res = createMockRes();

        await serveImage(req, res);
        expect(res.redirectStatus).toBe(302);
        expect(res.redirectUrl).toBe('https://b2.example.com/signed-image-url');
      }
      expect(b2State.getCommands.length).toBe(3);
    });
  });

  describe('2. Validated Image Decoding & Pixel Budget Enforcement', () => {
    it('EXPLOIT REPRODUCTION: rejects non-image or SVG/XML payload disguised with image/png mimetype with 400 (not 500)', async () => {
      const svgBuffer = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><script>alert(1)</script></svg>');
      const req = {
        file: { buffer: svgBuffer, mimetype: 'image/png', originalname: 'fake.png' },
        query: {},
      };
      const res = createMockRes();

      await uploadQuestionImage(req, res);
      expect(res.statusCode).toBe(400);
      expect(b2State.putCommands.length).toBe(0);
    });

    it('EXPLOIT REPRODUCTION: rejects image exceeding maximum allowed dimensions (> 6000px) with 400', async () => {
      const oversizedPng = await sharp({
        create: {
          width: 6001,
          height: 10,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .png()
        .toBuffer();

      const req = {
        files: {
          questionImage: [{ buffer: oversizedPng, mimetype: 'image/png', originalname: 'wide.png' }],
        },
        body: { topic: 'geometry', correctLetter: 'a' },
        query: {},
      };
      const res = createMockRes();

      await uploadImageQuestion(req, res);
      expect(res.statusCode).toBe(400);
      expect(b2State.putCommands.length).toBe(0);
    });

    it('preserves valid PNG/JPEG/WebP question and solution image uploads', async () => {
      const validPng = await sharp({
        create: {
          width: 200,
          height: 150,
          channels: 3,
          background: { r: 20, g: 40, b: 60 },
        },
      })
        .png()
        .toBuffer();

      const req = {
        file: { buffer: validPng, mimetype: 'image/png', originalname: 'diagram.png' },
        query: {},
      };
      const res = createMockRes();

      await uploadSolutionImage(req, res);
      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('url');
      expect(res.body).toHaveProperty('key');
      expect(b2State.putCommands.length).toBe(1);
    });
  });
});
