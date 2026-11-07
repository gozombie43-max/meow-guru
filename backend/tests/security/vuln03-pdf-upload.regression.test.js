import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import express from 'express';
import { once } from 'node:events';

const b2State = vi.hoisted(() => ({
  putCommands: [],
  getCommands: [],
}));

vi.mock('../../config/b2.js', () => ({
  B2_BUCKET: 'test-pdf-bucket',
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
    return 'https://b2.example.com/signed-pdf-url';
  }),
}));

vi.mock('../../services/documents/pdfCatalogService.js', () => ({
  invalidatePdfCache: vi.fn(async () => {}),
  listTopicPdfs: vi.fn(async (topic, category) => [
    {
      id: 'pdf-YWxnZWJyYS9ub3Rlcy9zYW1wbGUucGRm',
      title: 'Sample',
      topic,
      category,
      blobPath: `${topic}/${category}/sample.pdf`,
      fileName: 'sample.pdf',
      size: 128,
      uploadedAt: new Date().toISOString(),
      streamUrl: '/api/pdfs/stream/pdf-YWxnZWJyYS9ub3Rlcy9zYW1wbGUucGRm',
    },
  ]),
}));

vi.mock('../../repositories/adminUserRepository.js', () => ({
  findCurrentAdminUser: vi.fn(async (id) => ({
    id,
    role: 'admin',
    status: 'active',
  })),
}));

vi.mock('../../auth/sessions.js', () => ({
  assertSession: vi.fn(async () => {}),
}));

import { signToken } from '../../auth/jwt.js';
import {
  allowedExtensions,
  isAllowedDocument,
  verifyPdfMagicBytes,
  getPdfId,
} from '../../services/documents/pdfDocumentModel.js';
import pdfsRouter from '../../routes/pdfs.js';
import { errorHandler } from '../../middleware/errorHandler.js';

describe('VULN-03 Regression: PDF Upload Abuse, Rate-Limit Exemption & Stored HTML/XSS', () => {
  let server;
  let baseUrl;
  let adminToken;

  beforeAll(async () => {
    adminToken = signToken({ id: 'admin_vuln03', role: 'admin' });
    const app = express();
    app.use(express.json());
    app.use('/api/pdfs', pdfsRouter);
    app.use(errorHandler);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(() => {
    b2State.putCommands.length = 0;
    b2State.getCommands.length = 0;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('1. Document Model & Anti-XSS Validation', () => {
    it('EXPLOIT REPRODUCTION: disallows .html and .htm extensions from allowedExtensions', () => {
      expect(allowedExtensions.has('.html')).toBe(false);
      expect(allowedExtensions.has('.htm')).toBe(false);
      expect(allowedExtensions.has('.pdf')).toBe(true);
    });

    it('EXPLOIT REPRODUCTION: rejects .html and .htm files in isAllowedDocument', () => {
      expect(
        isAllowedDocument({
          originalname: 'xss.html',
          mimetype: 'text/html',
          buffer: Buffer.from('<!doctype html><script>alert(1)</script>'),
        })
      ).toBe(false);

      expect(
        isAllowedDocument({
          originalname: 'xss.htm',
          mimetype: 'text/html',
          buffer: Buffer.from('<img src=x onerror=alert(1)>'),
        })
      ).toBe(false);
    });

    it('EXPLOIT REPRODUCTION: rejects disguised .pdf lacking %PDF- magic bytes', () => {
      const disguisedHtml = {
        originalname: 'notes.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('<svg onload="alert(document.domain)"></svg>'),
      };
      expect(typeof verifyPdfMagicBytes).toBe('function');
      expect(verifyPdfMagicBytes(disguisedHtml.buffer)).toBe(false);
      expect(isAllowedDocument(disguisedHtml)).toBe(false);
    });

    it('EXPLOIT REPRODUCTION: rejects polyglot PDF containing active HTML/script tags', () => {
      const polyglotPdf = {
        originalname: 'polyglot.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7\n<html><script>alert(1)</script></html>\n%%EOF'),
      };
      expect(isAllowedDocument(polyglotPdf)).toBe(false);
    });

    it('accepts valid PDF starting with %PDF- magic bytes', () => {
      const validPdf = {
        originalname: 'algebra_notes.pdf',
        mimetype: 'application/pdf',
        buffer: Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF'),
      };
      expect(verifyPdfMagicBytes(validPdf.buffer)).toBe(true);
      expect(isAllowedDocument(validPdf)).toBe(true);
    });
  });

  describe('2. HTTP Upload & Stream Endpoint Security', () => {
    const uploadMultipart = async (fileName, contentBuffer, mimeType = 'application/pdf', fieldName = 'files') => {
      const form = new FormData();
      form.append('topic', 'algebra');
      form.append('category', 'notes');
      form.append(fieldName, new Blob([contentBuffer], { type: mimeType }), fileName);

      return fetch(`${baseUrl}/api/pdfs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: form,
      });
    };

    it('EXPLOIT REPRODUCTION: rejects HTML file upload via POST /api/pdfs with 400', async () => {
      const res = await uploadMultipart(
        'malicious.html',
        Buffer.from('<html><body><script>alert(1)</script></body></html>'),
        'text/html'
      );
      expect(res.status).toBe(400);
      expect(b2State.putCommands.length).toBe(0);
    });

    it('EXPLOIT REPRODUCTION: rejects fake PDF without %PDF- magic bytes via POST /api/pdfs with 400', async () => {
      const res = await uploadMultipart(
        'fake.pdf',
        Buffer.from('<html><body>Not a real PDF</body></html>'),
        'application/pdf'
      );
      expect(res.status).toBe(400);
      expect(b2State.putCommands.length).toBe(0);
    });

    it('EXPLOIT REPRODUCTION: rejects oversized upload (> 20 MB) before buffering 100 MB in memory', async () => {
      const oversizedBuffer = Buffer.alloc(21 * 1024 * 1024, 0x41);
      oversizedBuffer.write('%PDF-1.7\n', 0, 'utf8');
      const res = await uploadMultipart('huge.pdf', oversizedBuffer, 'application/pdf');
      expect([400, 413]).toContain(res.status);
      expect(b2State.putCommands.length).toBe(0);
    });

    it('preserves legitimate PDF upload and returns expected 201 contract', async () => {
      const validPdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
      const res = await uploadMultipart('formulas.pdf', validPdfBuffer, 'application/pdf');
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.pdf).toMatchObject({
        topic: 'algebra',
        category: 'notes',
        fileName: 'formulas.pdf',
      });
      expect(Array.isArray(body.pdfs)).toBe(true);
      expect(b2State.putCommands.length).toBe(1);
    });

    it('enforces safe Content-Type and Content-Disposition on GET /api/pdfs/stream/:id', async () => {
      const id = getPdfId('algebra/notes/formulas.pdf');
      const res = await fetch(`${baseUrl}/api/pdfs/stream/${id}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.url).toBe('https://b2.example.com/signed-pdf-url');
      expect(b2State.getCommands.length).toBe(1);
      const cmdInput = b2State.getCommands[0].input;
      expect(cmdInput.ResponseContentType).toBe('application/pdf');
      expect(cmdInput.ResponseContentDisposition).toContain('inline; filename="formulas.pdf"');
    });
  });
});
