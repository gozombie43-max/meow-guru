import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from 'redis';

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export async function until(check, timeout = 20000) {
  const end = Date.now() + timeout;
  let error;
  while (Date.now() < end) {
    try { const value = await check(); if (value) return value; } catch (failure) { if (failure.fatal) throw failure; error = failure; }
    await sleep(100);
  }
  throw error || new Error('Fault fixture timed out');
}
export async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
export function ownedProcess(executable, args, options = {}) {
  const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...options });
  let output = '';
  const capture = chunk => { output = (output + chunk).slice(-16000); };
  child.stdout?.on('data', capture); child.stderr?.on('data', capture);
  child.failure = null;
  child.on('error', error => { child.failure = error; });
  child.diagnostic = () => output;
  return child;
}
export async function stopOwned(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = new Promise(resolve => child.once('exit', resolve));
  child.kill('SIGKILL');
  await exited;
}
export async function probeRedis(url) {
  const client = createClient({ url, disableOfflineQueue: true, socket: { connectTimeout: 300, reconnectStrategy: false }, commandOptions: { timeout: 1000 } });
  client.on('error', () => {});
  try { await client.connect(); return client; } catch (error) { client.destroy(); throw error; }
}
export async function disposableRedis(policy = 'allkeys-lru') {
  const directory = await mkdtemp(join(tmpdir(), 'meow-redis-fault-'));
  const port = await freePort(), url = `redis://127.0.0.1:${port}`;
  let child;
  const start = async () => {
    child = ownedProcess(process.env.REDIS_FAULT_TEST_BIN, ['--bind', '127.0.0.1', '--port', String(port), '--protected-mode', 'yes', '--maxmemory-policy', policy, '--save', '3600 1', '--appendonly', 'no'], { cwd: directory });
    await until(async () => {
      if (child.failure) throw child.failure;
      const client = await probeRedis(url);
      client.destroy(); return true;
    }, 10000);
  };
  const stop = () => stopOwned(child);
  try { await start(); } catch (error) { await stop(); throw error; }
  return { url, port, directory, start, stop };
}
