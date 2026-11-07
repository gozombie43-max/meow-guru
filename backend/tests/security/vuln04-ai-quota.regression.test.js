import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import express from 'express';
import { once } from 'node:events';

vi.mock('../../auth/sessions.js', () => ({
  assertSession: vi.fn(async (decoded) => decoded),
}));

vi.mock('../../ai/azureClient.js', () => ({
  chatComplete: vi.fn(),
}));

vi.mock('../../repositories/tutorQuotaRepository.js', () => ({
  reserveTutorUsage: vi.fn(),
}));

vi.mock('../../middleware/rateLimiter.js', () => ({
  aiLimiter: (_req, _res, next) => next(),
}));

vi.mock('../../middleware/aiAdmission.js', () => ({
  aiAdmission: (_req, _res, next) => next(),
  acquireAiLease: vi.fn().mockResolvedValue({ leaseId: 'lease_test_1' }),
  releaseAiLease: vi.fn().mockResolvedValue(undefined),
}));

import { signToken } from '../../auth/jwt.js';
import aiRoutes from '../../routes/aiRoutes.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { chatComplete } from '../../ai/azureClient.js';
import { reserveTutorUsage } from '../../repositories/tutorQuotaRepository.js';

describe('VULN-04 Regression: POST /api/ai/explain Quota Bypass, Unbounded Prompt & Unhandled TypeError', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/ai', aiRoutes);
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
    vi.clearAllMocks();
    chatComplete.mockResolvedValue('Step 1: Simplify the expression...');
    reserveTutorUsage.mockResolvedValue(undefined);
  });

  const postExplain = (body, token = signToken({ id: 'student_vuln04', role: 'user' })) =>
    fetch(`${baseUrl}/api/ai/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });

  it('rejects unauthenticated requests with 401', async () => {
    const res = await postExplain({ question: 'What is 2+2?' }, null);
    expect(res.status).toBe(401);
  });

  it('rejects missing or whitespace-only question with 400', async () => {
    const res1 = await postExplain({ question: '' });
    expect(res1.status).toBe(400);
    expect(await res1.json()).toEqual({ error: 'question is required' });

    const res2 = await postExplain({ question: '   ' });
    expect(res2.status).toBe(400);
    expect(await res2.json()).toEqual({ error: 'question is required' });
  });

  it('EXPLOIT REPRODUCTION: rejects oversized question (> 4000 characters) with 413 without calling AI provider', async () => {
    const res = await postExplain({ question: 'A'.repeat(4001) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: 'Question text is too long' });
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it('EXPLOIT REPRODUCTION: handles non-array options gracefully with 400 instead of throwing unhandled 500 TypeError', async () => {
    const resNum = await postExplain({ question: 'What is 2+2?', options: 12345 });
    expect(resNum.status).toBe(400);
    const bodyNum = await resNum.json();
    expect(bodyNum.error).toContain('options');
    expect(chatComplete).not.toHaveBeenCalled();

    const resObj = await postExplain({ question: 'What is 2+2?', options: { a: '4' } });
    expect(resObj.status).toBe(400);
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it('EXPLOIT REPRODUCTION: rejects options array exceeding 10 items or containing oversized/non-string items with 400', async () => {
    const resTooMany = await postExplain({
      question: 'What is 2+2?',
      options: Array.from({ length: 11 }, (_, i) => `Opt ${i}`),
    });
    expect(resTooMany.status).toBe(400);
    expect(chatComplete).not.toHaveBeenCalled();

    const resOversizedOpt = await postExplain({
      question: 'What is 2+2?',
      options: ['A', 'B'.repeat(1001)],
    });
    expect(resOversizedOpt.status).toBe(400);
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it('EXPLOIT REPRODUCTION: enforces reserveTutorUsage before calling AI provider and propagates 429 quota exhaustion', async () => {
    reserveTutorUsage.mockRejectedValueOnce(
      Object.assign(new Error('Your daily Tutor allowance has been reached. Please try again tomorrow.'), {
        statusCode: 429,
      })
    );

    const res = await postExplain({
      question: 'What is 15% of 200?',
      options: ['20', '30', '40', '50'],
      correctAnswer: 1,
    });
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toEqual({
      success: false,
      error: 'Your daily Tutor allowance has been reached. Please try again tomorrow.',
    });
    expect(reserveTutorUsage).toHaveBeenCalledOnce();
    expect(chatComplete).not.toHaveBeenCalled();
  });

  it('preserves valid explanation workflow and reserves quota when within allowance', async () => {
    const res = await postExplain({
      question: 'What is 5 * 5?',
      options: ['10', '25', '30', '35'],
      correctAnswer: 1,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      explanation: 'Step 1: Simplify the expression...',
    });
    expect(reserveTutorUsage).toHaveBeenCalledWith(
      'student_vuln04',
      expect.objectContaining({
        question: 'What is 5 * 5?',
        options: ['10', '25', '30', '35'],
      })
    );
    expect(chatComplete).toHaveBeenCalledOnce();
  });
});
