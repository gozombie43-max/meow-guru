import { getObject } from './objectStorage.js';
import { extractAttachmentContext } from '../services/tutorExtraction.js';
import { tutorChat } from '../services/tutorChatService.js';

process.once('message', async ({ key }) => {
  try {
    const { input, file } = JSON.parse((await getObject(key)).toString());
    const context = await extractAttachmentContext({ ...file, buffer: Buffer.from(file.data, 'base64') });
    const result = await tutorChat(input, context);
    process.send({ result }, () => process.exit(0));
  } catch {
    process.send({ error: 'Attachment processing failed' }, () => process.exit(1));
  }
});
