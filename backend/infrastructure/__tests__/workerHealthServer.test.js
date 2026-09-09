import { afterEach, expect, it } from 'vitest';
import { startWorkerHealthServer } from '../workerHealthServer.js';

let healthServer;
afterEach(async () => healthServer?.close());

it('reports worker readiness without exposing other routes', async () => {
  let ready = false;
  healthServer = await startWorkerHealthServer('maintenance', () => ready, { enabled: true, port: 0 });
  const endpoint = `http://127.0.0.1:${healthServer.port}`;

  let response = await fetch(`${endpoint}/live`);
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({ role: 'maintenance', ready: false });

  ready = true;
  response = await fetch(`${endpoint}/`);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ role: 'maintenance', ready: true });
  expect((await fetch(`${endpoint}/internal`)).status).toBe(404);
});
