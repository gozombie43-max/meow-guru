import { processTutorAttachmentJob } from '../services/processTutorAttachmentJob.js';
import { withTrace, withTraceCarrier } from './tracing.js';

process.once('message', async ({ job, trace }) => {
  try {
    const result = await withTraceCarrier(trace, () => withTrace('job.tutor.extract', {}, () => processTutorAttachmentJob(job)));
    await globalThis.__shutdownTelemetry?.();
    process.send({ result }, () => process.exit(0));
  } catch {
    await globalThis.__shutdownTelemetry?.();
    process.send({ error: 'Attachment processing failed' }, () => process.exit(1));
  }
});
