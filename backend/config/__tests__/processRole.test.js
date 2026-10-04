import { describe, it, expect } from 'vitest';
import { assertProcessRole, embeddedWorkersEnabled } from '../processRole.js';

describe('process ownership', () => {
  it('keeps API workers off unless explicitly enabled', () => {
    expect(embeddedWorkersEnabled({ NODE_ENV: 'production' })).toBe(false);
    expect(embeddedWorkersEnabled({ RUN_EMBEDDED_WORKERS: 'false' })).toBe(false);
    expect(embeddedWorkersEnabled({ RUN_EMBEDDED_WORKERS: 'true' })).toBe(true);
    expect(embeddedWorkersEnabled({ RUN_EMBEDDED_WORKERS: 'true', QUIZ_ONLY_MODE: 'true' })).toBe(false);
  });
  it('rejects a deployment role paired with the wrong entry point', () => {
    expect(assertProcessRole('api', {})).toBe('api');
    expect(assertProcessRole('attachments', { PROCESS_ROLE: 'attachments' })).toBe('attachments');
    expect(() => assertProcessRole('api', { PROCESS_ROLE: 'worker' })).toThrow('cannot run');
    expect(() => assertProcessRole('worker', { PROCESS_ROLE: 'api' })).toThrow('cannot run');
    expect(() => assertProcessRole('api', { PROCESS_ROLE: 'unknown' })).toThrow('cannot run');
  });
});
