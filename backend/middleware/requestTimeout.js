const DEFAULT_STANDARD_TIMEOUT_MS = 30_000;
const DEFAULT_EXTENDED_TIMEOUT_MS = 60_000;

function parseTimeoutMs(raw, fallback, min = 100, max = 300_000) {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return Math.min(max, parsed);
}

export function isExtendedTimeoutRoute(req) {
  const path = String(req.originalUrl || req.url || req.path || '').split('?')[0];
  if (
    path.startsWith('/api/ai') ||
    path.startsWith('/api/agent') ||
    path.startsWith('/api/upload') ||
    path.startsWith('/api/upload-note-image') ||
    path.startsWith('/api/mass-upload') ||
    path.startsWith('/api/pdfs') ||
    path.startsWith('/api/admin/question-imports') ||
    path.startsWith('/api/questions/image-zip') ||
    path.startsWith('/api/questions/admin/image-zip') ||
    path.startsWith('/api/questions/bulk') ||
    path.startsWith('/api/questions/export') ||
    path.startsWith('/api/mocktest/admin/') ||
    (path.startsWith('/api/training/sessions/') && path.endsWith('/diagnosis'))
  ) {
    return true;
  }
  const contentType = String(req.headers?.['content-type'] || '').toLowerCase();
  return contentType.includes('multipart/form-data');
}

export function resolveRequestTimeoutMs(req, options = {}) {
  const standardMs =
    options.standardTimeoutMs ??
    parseTimeoutMs(process.env.HTTP_ROUTE_TIMEOUT_MS, DEFAULT_STANDARD_TIMEOUT_MS);
  const extendedMs =
    options.extendedTimeoutMs ??
    parseTimeoutMs(process.env.HTTP_AI_REQUEST_TIMEOUT_MS, DEFAULT_EXTENDED_TIMEOUT_MS);
  return isExtendedTimeoutRoute(req) ? extendedMs : standardMs;
}

export function requestTimeout(options = {}) {
  return (req, res, next) => {
    const controller = new AbortController();
    req.abortController = controller;
    req.abortSignal = controller.signal;
    if (res.locals && typeof res.locals === 'object') {
      res.locals.abortSignal = controller.signal;
    }

    const timeoutMs = resolveRequestTimeoutMs(req, options);
    let cleanedUp = false;

    const timer = setTimeout(() => {
      if (cleanedUp) return;
      if (!controller.signal.aborted) {
        controller.abort(
          Object.assign(new Error('Request timed out'), {
            name: 'TimeoutError',
            code: 'REQUEST_TIMEOUT',
            statusCode: 504,
          }),
        );
      }
      if (!res.headersSent && !res.writableEnded) {
        const requestId = req.id || res.getHeader?.('x-request-id') || undefined;
        res.status(504).json({
          error: 'Request timed out',
          code: 'REQUEST_TIMEOUT',
          ...(requestId ? { requestId: String(requestId) } : {}),
        });
      }
    }, timeoutMs);

    if (typeof timer.unref === 'function') {
      timer.unref();
    }

    const onDisconnect = () => {
      if (!res.writableEnded && !controller.signal.aborted) {
        controller.abort(
          Object.assign(new Error('Client disconnected'), {
            name: 'AbortError',
            code: 'CLIENT_ABORTED',
          }),
        );
      }
      cleanup();
    };

    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      clearTimeout(timer);
      req.off?.('aborted', onDisconnect);
      res.off?.('close', onDisconnect);
      res.off?.('finish', cleanup);
    };

    req.once?.('aborted', onDisconnect);
    res.once?.('close', onDisconnect);
    res.once?.('finish', cleanup);

    next();
  };
}
