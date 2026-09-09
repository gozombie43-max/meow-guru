import { createServer } from 'node:http';

export async function startWorkerHealthServer(role, isReady, options = {}) {
  const enabled = options.enabled ?? process.env.WORKER_HTTP_HEALTH === 'true';
  if (!enabled) return { port: null, close: async () => {} };
  const port = Number(options.port ?? process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('Worker health port is invalid');

  const server = createServer((req, res) => {
    if (req.url !== '/' && req.url !== '/live') {
      res.writeHead(404).end();
      return;
    }
    const ready = isReady();
    res.writeHead(ready ? 200 : 503, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ role, ready }));
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', resolve);
  });
  return {
    port: server.address().port,
    close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}
