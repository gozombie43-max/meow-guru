import { createServer } from 'node:net';
import { setTimeout } from 'node:timers/promises';
import { listenServer } from '../infrastructure/httpListen.js';

export async function waitForPort(port, { signal, intervalMs = 1000, onBusy = () => {} } = {}) {
  let reported = false;
  for (;;) {
    signal?.throwIfAborted();
    const probe = createServer();
    try {
      await listenServer(probe, port);
      await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
      return;
    } catch (error) {
      if (error.code !== 'EADDRINUSE') throw error;
      if (!reported) {
        reported = true;
        onBusy(port);
      }
      await setTimeout(intervalMs, undefined, { signal });
    }
  }
}
