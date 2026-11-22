import { parentPort } from 'node:worker_threads';
import bcrypt from 'bcryptjs';

if (parentPort) {
  parentPort.on('message', async (msg) => {
    const { id, op, password, hashOrRounds } = msg || {};
    try {
      const result =
        op === 'hash'
          ? await bcrypt.hash(String(password), Number(hashOrRounds) || 12)
          : await bcrypt.compare(String(password), String(hashOrRounds));
      parentPort.postMessage({ id, ok: true, result });
    } catch (error) {
      parentPort.postMessage({
        id,
        ok: false,
        error: error?.message || 'Password worker operation failed',
      });
    }
  });
}
