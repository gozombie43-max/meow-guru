import { getRuntimeHealth } from '../infrastructure/logger.js';
import { featureEnabled } from '../infrastructure/featureRollout.js';
import { dependencyHealth } from '../infrastructure/dependencyBoundary.js';
import { mongoPoolHealth } from '../config/mongodb.js';

export function optionalWorkAdmission(req, res, next) {
  if (!featureEnabled('USE_OVERLOAD_SHEDDING')) return next();
  const optional = /^\/api\/(?:ai|agent|training-curation)(?:\/|$)/.test(req.path) || /\/diagnosis$/.test(req.path);
  if (!optional || req.method !== 'POST') return next();
  const runtime = getRuntimeHealth();
  const memoryLimit = Number(process.env.OVERLOAD_RSS_MB) || 768;
  const lagLimit = Number(process.env.OVERLOAD_EVENT_LOOP_MS) || 200;
  const ai = dependencyHealth().ai;
  const pressured = mongoPoolHealth().waiting >= 10 || (ai?.active >= ai?.limit && ai?.queued >= 3);
  if (pressured || runtime.eventLoopP99Ms > lagLimit || runtime.rssBytes > memoryLimit * 1024 * 1024) return res.status(503).set('Retry-After', '3').json({ error: 'Optional work is temporarily busy', code: 'OVERLOADED' });
  next();
}
