import { describe, it, expect, vi } from 'vitest';
import { errorHandler, asyncHandler } from '../errorHandler.js';

describe('Error Handler Middleware', () => {
  it('sends JSON error response with custom status code', () => {
    const error = new Error('Invalid quiz session');
    error.status = 400;

    const req = {};
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status };
    const next = vi.fn();

    errorHandler(error, req, res, next);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ error: 'Invalid quiz session' });
  });

  it('defaults to 500 status code when none is provided', () => {
    const error = new Error('Database connection failed');

    const req = {};
    const json = vi.fn();
    const status = vi.fn().mockReturnValue({ json });
    const res = { status };
    const next = vi.fn();

    errorHandler(error, req, res, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalled();
  });

  it('asyncHandler forwards rejected promise errors to next()', async () => {
    const next = vi.fn();
    const asyncFn = async () => {
      throw new Error('Async explosion');
    };

    const handler = asyncHandler(asyncFn);
    await handler({}, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0].message).toBe('Async explosion');
  });
});
