import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const run = promisify(execFile);
const backendRoot = fileURLToPath(new URL('../../', import.meta.url));

function cleanCiEnvironment() {
  const env = { ...process.env };
  for (const name of ['NODE_ENV', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'REDIS_URL', 'QUEUE_REDIS_URL']) delete env[name];
  // A fixture must supply its own identity even under an inherited deployment setting.
  env.DEPLOYMENT_ENVIRONMENT = 'production';
  env.DOTENV_CONFIG_PATH = join(tmpdir(), `missing-ci-env-${randomUUID()}.env`);
  return env;
}

it('loads the optional-integration smoke check on a runner without JWT credentials', async () => {
  const { stdout } = await run(process.execPath, ['scripts/verify-app-no-optional-integrations.js'], {
    cwd: backendRoot, env: cleanCiEnvironment(), timeout: 30_000, windowsHide: true,
  });
  expect(stdout).toContain('Backend app and training route load without optional B2/Firebase credentials.');
}, 35_000);

it('exports real HTTP and Mongo spans without deployment secrets or a local dotenv file', async () => {
  const { stdout } = await run(process.execPath, ['scripts/verify-tracing-runtime.js', '--with-mongo'], {
    cwd: backendRoot, env: cleanCiEnvironment(), timeout: 45_000, windowsHide: true,
  });
  expect(stdout).toContain('ESM preload, fetch/Mongo instrumentation, OTLP export and URL redaction passed.');
}, 50_000);
