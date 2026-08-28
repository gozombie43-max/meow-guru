import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../validation.js';

describe('Validation Middleware', () => {
  const userSchema = z.object({
    email: z.string().email(),
    age: z.number().min(18),
  });

  it('passes validation when request body is valid', () => {
    const req = { body: { email: 'student@example.com', age: 20 } };
    const res = {};
    const next = vi.fn();

    const middleware = validateBody(userSchema);
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body.email).toBe('student@example.com');
  });

  it('returns 400 with details when request body fails validation', () => {
    const req = { body: { email: 'not-an-email', age: 16 } };
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status };
    const next = vi.fn();

    const middleware = validateBody(userSchema);
    middleware(req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Validation failed',
        details: expect.any(Array),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('validates query parameters properly', () => {
    const querySchema = z.object({
      limit: z.coerce.number().min(1).max(100),
    });

    const req = { query: { limit: '25' } };
    const res = {};
    const next = vi.fn();

    validateQuery(querySchema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.query.limit).toBe(25);
  });

  it('validates url params properly', () => {
    const paramsSchema = z.object({
      id: z.string().min(3),
    });

    const req = { params: { id: 'abc' } };
    const res = {};
    const next = vi.fn();

    validateParams(paramsSchema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
