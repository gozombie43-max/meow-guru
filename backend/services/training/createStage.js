import { withTrace } from '../../infrastructure/tracing.js';
import { trainingCreateStageDuration } from '../../infrastructure/metrics.js';
import { logger } from '../../infrastructure/logger.js';

// Call sites supply fixed stage names. Never label metrics with learner IDs,
// filters, topics, session IDs or exception messages.
export function measureTrainingCreate(stage, work) {
  return withTrace(`training.create.${stage}`, { 'training.stage': stage }, async () => {
    const started = performance.now();
    let outcome = 'success';
    try { return await work(); }
    catch (error) { outcome = 'error'; throw error; }
    finally {
      const durationMs = performance.now() - started;
      trainingCreateStageDuration.observe({ stage, outcome }, durationMs / 1000);
      logger.info({ event: `training.create.${stage}`, durationMs: Math.round(durationMs), outcome });
    }
  });
}
