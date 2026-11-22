import http from 'node:http';
import { once } from 'node:events';
import express from 'express';
import { describe, expect, it } from 'vitest';
import { requestTimeout } from '../requestTimeout.js';

describe('requestTimeout middleware (Node 22 HTTP lifecycle)', () => {
  it('keeps req.abortSignal unaborted during normal POST JSON requests with async handler delay', async () => {
    let signalAbortedDuringHandler = null;
    const app = express();
    app.use(requestTimeout({ standardTimeoutMs: 2_000 }));
    app.use(express.json());
    app.post('/echo', async (req, res) => {
      await new Promise((r) => setTimeout(r, 60));
      signalAbortedDuringHandler = req.abortSignal?.aborted;
      res.status(200).json({ echoed: req.body, aborted: req.abortSignal?.aborted });
    });

    const server = http.createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
      const response = await fetch(`${baseUrl}/echo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hello: 'world', items: [1, 2, 3] }),
      });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toEqual({
        echoed: { hello: 'world', items: [1, 2, 3] },
        aborted: false,
      });
      expect(signalAbortedDuringHandler).toBe(false);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('returns 504 with code REQUEST_TIMEOUT and aborts req.abortSignal when request exceeds timeout', async () => {
    let capturedSignal = null;
    const app = express();
    app.use((req, _res, next) => {
      req.id = 'req-504-trace';
      next();
    });
    app.use(requestTimeout({ standardTimeoutMs: 50 }));
    app.use(express.json());
    app.post('/timeout', (req, res) => {
      capturedSignal = req.abortSignal;
      setTimeout(() => {
        if (!res.headersSent) res.json({ late: true });
      }, 250);
    });

    const server = http.createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
      const response = await fetch(`${baseUrl}/timeout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: true }),
      });
      expect(response.status).toBe(504);
      expect(await response.json()).toEqual({
        error: 'Request timed out',
        code: 'REQUEST_TIMEOUT',
        requestId: 'req-504-trace',
      });
      expect(capturedSignal).toBeTruthy();
      expect(capturedSignal.aborted).toBe(true);
      expect(capturedSignal.reason?.code).toBe('REQUEST_TIMEOUT');
    } finally {
      await new Promise((r) => server.close(r));
    }
  });

  it('aborts req.abortSignal when the client prematurely aborts the connection', async () => {
    let enteredHandler;
    let releaseHandler;
    const handlerEntered = new Promise((r) => {
      enteredHandler = r;
    });
    const handlerGate = new Promise((r) => {
      releaseHandler = r;
    });
    let capturedSignal = null;
    let abortFiredPromise = null;

    const app = express();
    app.use(requestTimeout({ standardTimeoutMs: 5_000 }));
    app.use(express.json());
    app.post('/abort-me', async (req, res) => {
      capturedSignal = req.abortSignal;
      abortFiredPromise = new Promise((resolve) => {
        if (req.abortSignal.aborted) return resolve(true);
        req.abortSignal.addEventListener('abort', () => resolve(true), { once: true });
      });
      enteredHandler();
      await handlerGate;
      if (!res.headersSent && !res.writableEnded) {
        res.json({ ok: true });
      }
    });

    const server = http.createServer(app);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const baseUrl = `http://127.0.0.1:${server.address().port}`;

    try {
      const clientAbort = new AbortController();
      const pendingFetch = fetch(`${baseUrl}/abort-me`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cancel: true }),
        signal: clientAbort.signal,
      }).catch(() => null);

      await handlerEntered;
      expect(capturedSignal.aborted).toBe(false);

      clientAbort.abort();
      await pendingFetch;
      await abortFiredPromise;

      expect(capturedSignal.aborted).toBe(true);
      expect(capturedSignal.reason?.code).toBe('CLIENT_ABORTED');
    } finally {
      releaseHandler?.();
      await new Promise((r) => server.close(r));
    }
  });
});
