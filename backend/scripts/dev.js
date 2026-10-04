import 'dotenv/config';
import { waitForPort } from './wait-for-port.js';

const port = Number(process.env.PORT || 10000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('[dev] PORT must be an integer between 1 and 65535.');
  process.exit(1);
}

const abort = new AbortController();
const stopWaiting = () => abort.abort();
process.once('SIGINT', stopWaiting);
process.once('SIGTERM', stopWaiting);

try {
  await waitForPort(port, {
    signal: abort.signal,
    onBusy: () => console.log(
      `[dev] Port ${port} is already in use. Waiting for it to be released. ` +
      'Stop the existing backend in its terminal (Ctrl+C); this session will start automatically.',
    ),
  });
} catch (error) {
  if (!abort.signal.aborted) {
    console.error(`[dev] Cannot use port ${port}: ${error.message}`);
    process.exitCode = 1;
  }
} finally {
  process.off('SIGINT', stopWaiting);
  process.off('SIGTERM', stopWaiting);
}

if (!abort.signal.aborted && !process.exitCode) {
  // Instrumentation must register before importing application dependencies.
  await import('../instrumentation.js');
  await import('../index.js');
}
