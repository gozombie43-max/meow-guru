import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from '../validation.js';

describe('Validation Middleware', () => {
  it('uses an optional generic invalid-body response without calling the handler', () => {
    const req = { body: { email: 'invalid' } };
    const res = {};
    const next = vi.fn();
    const onInvalid = vi.fn();
    validateBody(z.object({ email: z.string().email() }), { onInvalid })(req, res, next);
    expect(onInvalid).toHaveBeenCalledExactlyOnceWith(req, res);
    expect(next).not.toHaveBeenCalled();
  });

  it('normalizes and strips the body before continuing without invoking the invalid callback', () => {
    const req = { body: { email: ' Alice@Example.com ', extra: 'discard' } };
    const next = vi.fn();
    const onInvalid = vi.fn();
    validateBody(z.object({ email: z.string().trim().email().toLowerCase() }), { onInvalid })(req, {}, next);
    expect(req.body).toEqual({ email: 'alice@example.com' });
    expect(next).toHaveBeenCalledOnce();
    expect(onInvalid).not.toHaveBeenCalled();
  });

  it('forwards unexpected schema errors even when an invalid-body callback exists', () => {
    const error = new Error('Unexpected failure');
    const schema = { parse: () => { throw error; } };
    const next = vi.fn();
    const onInvalid = vi.fn();
    validateBody(schema, { onInvalid })({ body: {} }, {}, next);
    expect(next).toHaveBeenCalledWith(error);
    expect(onInvalid).not.toHaveBeenCalled();
  });
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
