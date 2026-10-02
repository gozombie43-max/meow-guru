import { getObject } from './objectStorage.js';
import { extractAttachmentContext } from '../services/tutorExtraction.js';
import { tutorChat } from '../services/tutorChatService.js';
import { withTrace, withTraceCarrier } from './tracing.js';

process.once('message', async ({ key, trace }) => {
  try {
    const result = await withTraceCarrier(trace, () => withTrace('job.tutor.extract', {}, async () => {
      const { input, file } = JSON.parse((await getObject(key)).toString());
      const context = await extractAttachmentContext({ ...file, buffer: Buffer.from(file.data, 'base64') });
      return tutorChat(input, context);
    }));
    await globalThis.__shutdownTelemetry?.();
    process.send({ result }, () => process.exit(0));
  } catch {
    await globalThis.__shutdownTelemetry?.();
    process.send({ error: 'Attachment processing failed' }, () => process.exit(1));
  }
});
