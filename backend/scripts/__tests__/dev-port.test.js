import { createServer } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenServer } from '../../infrastructure/httpListen.js';
import { waitForPort } from '../wait-for-port.js';

const servers = [];
const controllers = [];
afterEach(async () => {
  controllers.splice(0).forEach((controller) => controller.abort());
  await Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))));
});

async function occupyPort() {
  const server = createServer();
  servers.push(server);
  await listenServer(server, 0);
  return { server, port: server.address().port };
}

describe('backend development port conflicts', () => {
  it('waits without displacing the listener, reports once, then proceeds when released', async () => {
    const { server, port } = await occupyPort();
    const onBusy = vi.fn();
    let started = false;
    const waiting = waitForPort(port, { intervalMs: 10, onBusy }).then(() => { started = true; });
    await vi.waitFor(() => expect(onBusy).toHaveBeenCalledOnce());
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(started).toBe(false);
    expect(server.listening).toBe(true);
    expect(onBusy).toHaveBeenCalledOnce();
    await new Promise((resolve) => server.close(resolve));
    await waiting;
    expect(started).toBe(true);
    // The preflight itself must leave the port available for application startup.
    await listenServer(server, port);
  });

  it('allows a waiting session to stop without affecting the active server', async () => {
    const { server, port } = await occupyPort();
    const controller = new AbortController();
    controllers.push(controller);
    const waiting = waitForPort(port, { signal: controller.signal, intervalMs: 10 });
    const result = expect(waiting).rejects.toMatchObject({ name: 'AbortError' });
    controller.abort();
    await result;
    expect(server.listening).toBe(true);
  });

  it('rejects invalid port configuration instead of waiting indefinitely', async () => {
    await expect(waitForPort(-1)).rejects.toMatchObject({ code: 'ERR_SOCKET_BAD_PORT' });
  });

  it('handles a bind race as a normal startup rejection and removes temporary listeners', async () => {
    const { port } = await occupyPort();
    const contender = createServer();
    servers.push(contender);
    await expect(listenServer(contender, port)).rejects.toMatchObject({ code: 'EADDRINUSE' });
    expect(contender.listenerCount('listening')).toBe(0);
    expect(contender.listenerCount('error')).toBe(0);
  });
});
