// @ts-check
import { normalizeImage } from './validatedImage.js';

export const MAX_TUTOR_ATTACHMENT_BYTES = 8 * 1024 * 1024;
/** @param {{ buffer: Buffer, originalname: string, mimetype?: string }} file */
export async function validateTutorAttachment(file) {
  if (!file.buffer.length || file.buffer.length > MAX_TUTOR_ATTACHMENT_BYTES) throw Object.assign(new Error('Attachments must be between 1 byte and 8 MB'), { statusCode: 413 });
  if (/^%PDF-\d\.\d/.test(file.buffer.subarray(0, 16).toString('ascii'))) {
    if (!file.buffer.subarray(-2048).includes(Buffer.from('%%EOF'))) throw Object.assign(new Error('Invalid or truncated PDF'), { statusCode: 400 });
    return { buffer: file.buffer, originalname: file.originalname, mimetype: 'application/pdf' };
  }
  return { buffer: await normalizeImage(file.buffer), originalname: file.originalname, mimetype: 'image/webp' };
}
