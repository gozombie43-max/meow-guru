import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';

const require = createRequire(import.meta.url);
const { values } = parseArgs({ options: {
  output: { type: 'string' },
  restarts: { type: 'string', default: '3' },
  port: { type: 'string', default: '3120' },
} });
const restarts = Number(values.restarts), basePort = Number(values.port);
if (!Number.isInteger(restarts) || restarts < 1 || restarts > 10 || !Number.isInteger(basePort) || basePort < 1024 || basePort + restarts > 65535) {
  throw new Error('Use 1–10 restarts and an available nonprivileged base port.');
}

const samples = [];
for (let restart = 1; restart <= restarts; restart++) {
  const port = basePort + restart;
  const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'start', '--hostname', '127.0.0.1', '--port', String(port)], {
    cwd: process.cwd(), windowsHide: true,
    env: { ...process.env, API_URL: 'http://127.0.0.1:3111' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stderr.on('data', chunk => { logs += chunk; });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Startup timed out: ${logs}`)), 20000);
      child.stdout.on('data', chunk => {
        logs += chunk;
        if (logs.includes('Ready in')) { clearTimeout(timer); resolve(); }
      });
      child.on('error', error => { clearTimeout(timer); reject(error); });
      child.on('exit', code => { clearTimeout(timer); reject(new Error(`Early exit ${code}: ${logs}`)); });
    });
    // No login or health request warms this process before the first /play GET.
    // The dummy cookie exercises document routing, not authenticated API access.
    for (let request = 0; request < 3; request++) {
      const start = performance.now();
      const response = await fetch(`http://127.0.0.1:${port}/play`, {
        headers: { cookie: 'access_session=local-startup-fixture' }, redirect: 'manual', signal: AbortSignal.timeout(15000),
      });
      const responseHeadersMs = Number((performance.now() - start).toFixed(2));
      const body = await response.text();
      if (response.status !== 200 || !body.includes('Choose your training.')) throw new Error(`Unexpected /play document: ${response.status}`);
      samples.push({ restart, phase: request === 0 ? 'cold-first-request' : 'warm', responseHeadersMs });
    }
  } finally {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise(resolve => child.once('exit', resolve));
    }
  }
}
const report = {
  environment: 'Local production Next server; HTTP response-header timing after the CLI ready message, including lazy initialization. Distinct from authenticated browser rendering metrics.',
  objectiveMs: 800,
  passed: samples.every(sample => sample.responseHeadersMs < 800),
  samples,
};
if (values.output) await writeFile(values.output, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
