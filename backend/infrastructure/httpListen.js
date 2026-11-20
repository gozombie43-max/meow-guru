const DEFAULT_KEEP_ALIVE_TIMEOUT_MS = 65000;
const DEFAULT_HEADERS_TIMEOUT_MS = 66000;

function parseTimeoutMs(raw, fallback, min = 1000) {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback;
}

export function getHttpTimeoutConfig(env = process.env) {
  const keepAliveTimeout = parseTimeoutMs(env.HTTP_KEEP_ALIVE_TIMEOUT_MS, DEFAULT_KEEP_ALIVE_TIMEOUT_MS);
  const requestedHeadersTimeout = parseTimeoutMs(env.HTTP_HEADERS_TIMEOUT_MS, DEFAULT_HEADERS_TIMEOUT_MS);
  const headersTimeout = Math.max(requestedHeadersTimeout, keepAliveTimeout + 1000);
  return { keepAliveTimeout, headersTimeout };
}

// Turn asynchronous bind failures into startup errors handled by the caller.
export function listenServer(server, port, host = '0.0.0.0') {
  if (server && typeof server === 'object') {
    const { keepAliveTimeout, headersTimeout } = getHttpTimeoutConfig();
    server.keepAliveTimeout = keepAliveTimeout;
    server.headersTimeout = headersTimeout;
  }
  return new Promise((resolve, reject) => {
    const onError = (error) => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    try {
      server.listen(port, host);
    } catch (error) {
      server.off('error', onError);
      server.off('listening', onListening);
      reject(error);
    }
  });
}
