import { getObject } from '../infrastructure/objectStorage.js';
import { extractAttachmentContext } from './tutorExtraction.js';
import { tutorChat } from './tutorChatService.js';

export async function processTutorAttachmentJob(job) {
  let input, file;
  if (job.attachmentKey) {
    input = job.input;
    file = { ...job.attachment, buffer: await getObject(job.attachmentKey) };
  } else {
    // Drain pre-release jobs; new jobs contain raw object keys and input metadata.
    const legacy = JSON.parse((await getObject(job.inputKey)).toString());
    input = legacy.input;
    file = { ...legacy.file, buffer: Buffer.from(legacy.file.data, 'base64') };
  }
  return tutorChat(input, await extractAttachmentContext(file));
}
