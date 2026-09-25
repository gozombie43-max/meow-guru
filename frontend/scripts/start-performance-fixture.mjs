import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const children = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
function start(file, args = []) {
  const child = spawn(process.execPath, [file, ...args], { stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('exit', code => stop(code ?? 1));
  child.on('error', error => { console.error(error.message); stop(1); });
}
start('../backend/scripts/browser-fixture.js');
start(require.resolve('next/dist/bin/next'), ['start', '--hostname', '127.0.0.1', '--port', '3100']);
process.on('SIGTERM', () => stop());
process.on('SIGINT', () => stop());
