import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFileSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { getReleaseId, _resetCachedReleaseId } from '../releaseInfo.js';

const releaseFilePath = fileURLToPath(new URL('../../RELEASE_ID', import.meta.url));

describe('releaseInfo', () => {
  const originalEnv = process.env.RELEASE_ID;

  beforeEach(() => {
    _resetCachedReleaseId();
    delete process.env.RELEASE_ID;
    if (existsSync(releaseFilePath)) {
      rmSync(releaseFilePath, { force: true });
    }
  });

  afterEach(() => {
    _resetCachedReleaseId();
    if (originalEnv !== undefined) {
      process.env.RELEASE_ID = originalEnv;
    } else {
      delete process.env.RELEASE_ID;
    }
    if (existsSync(releaseFilePath)) {
      rmSync(releaseFilePath, { force: true });
    }
  });

  it('defaults to local when neither file nor env var is present', () => {
    expect(getReleaseId()).toBe('local');
  });

  it('uses process.env.RELEASE_ID when file is absent', () => {
    process.env.RELEASE_ID = 'test-sha-123';
    expect(getReleaseId()).toBe('test-sha-123');
  });

  it('prefers packaged RELEASE_ID file over process.env.RELEASE_ID', () => {
    writeFileSync(releaseFilePath, 'packaged-release-sha\n', 'utf8');
    process.env.RELEASE_ID = 'different-env-sha';
    expect(getReleaseId()).toBe('packaged-release-sha');
  });
});
