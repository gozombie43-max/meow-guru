export function reportOnlyCsp(backend: string, development = false) {
  const backendOrigin = new URL(backend).origin;
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self' https://accounts.google.com",
    `script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://apis.google.com https://accounts.google.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://code.iconify.design${development ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${backendOrigin} https://*.googleapis.com https://*.firebaseio.com https://*.firebasedatabase.app https://*.sentry.io https://cdn.jsdelivr.net https://cdnjs.cloudflare.com wss:${development ? ' ws:' : ''}`,
    "frame-src 'self' https://www.google.com https://accounts.google.com https://*.firebaseapp.com",
    "worker-src 'self' blob:",
    "media-src 'self' blob: data: https:",
    "report-uri /api/csp-report",
  ].join('; ');
}
