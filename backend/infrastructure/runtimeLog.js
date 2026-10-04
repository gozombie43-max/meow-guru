import { logger } from './logger.js';

const sensitive = /^(?:password(?:Hash)?|token|authorization|cookie|secret|apiKey|accessKey|refreshToken)$/i;
function safe(value, depth = 0) {
  if (depth > 5) return '[nested value]';
  if (Array.isArray(value)) return value.map(item => safe(item, depth + 1));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sensitive.test(key) ? '[Redacted]' : safe(item, depth + 1)]));
  return value;
}
function write(level, values) {
  const err = values.find(value => value instanceof Error);
  const message = typeof values[0] === 'string' ? values[0] : 'runtime event';
  const details = values.slice(typeof values[0] === 'string' ? 1 : 0).filter(value => value !== err);
  logger[level]({ ...(err ? { err } : {}), ...(details.length ? { details: safe(details) } : {}) }, message);
}
export const runtimeLog = {
  info: (...values) => write('info', values),
  warn: (...values) => write('warn', values),
  error: (...values) => write('error', values),
};
