import { once } from 'node:events';
import { randomBytes } from 'node:crypto';

for (const name of Object.keys(process.env)) {
  if (name.startsWith('B2_') || name.startsWith('FIREBASE_')) delete process.env[name];
}
process.env.NODE_ENV = 'test';
// Standalone CI probes do not load deployment secrets or Vitest's setup file.
process.env.DEPLOYMENT_ENVIRONMENT = 'test';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.REFRESH_TOKEN_SECRET = randomBytes(32).toString('hex');

const { createApp } = await import('../app.js');
const { app } = await createApp({
  isReady: () => true,
  isShuttingDown: () => false,
  quizOnlyMode: true,
});
const server = app.listen(0, '127.0.0.1');
await once(server, 'listening');

try {
  const response = await fetch(
    `http://127.0.0.1:${server.address().port}/api/training/capabilities`,
  );
  const body = await response.text();
  if (response.status !== 401 || !body.includes('No token provided')) {
    throw new Error(`Training route optional-integration smoke failed: HTTP ${response.status} ${body}`);
  }
  console.log('Backend app and training route load without optional B2/Firebase credentials.');
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
